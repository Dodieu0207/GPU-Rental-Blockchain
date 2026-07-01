// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GPURentalPlatform
 * @dev Smart contract chính cho đồ án DeCompute - Decentralized GPU Rental Platform.
 *
 * Contract này chỉ chịu trách nhiệm lưu thông tin GPU và tiền staking on-chain.
 * Solidity/smart contract KHÔNG thể tự quét phần cứng thật của máy tính.
 *
 * Luồng đúng của hệ thống:
 * 1. Agent Node.js trên máy chủ cho thuê GPU quét thông số phần cứng thật.
 * 2. Backend nhận dữ liệu từ agent, chuẩn hóa thông số và tạo hardwareSpecHash.
 * 3. Frontend/dApp lấy dữ liệu đã xác thực từ backend.
 * 4. Frontend gọi registerGPU(_spec, _specHash, _pricePerHour) và gửi kèm ETH staking.
 * 5. Smart contract lưu thông tin GPU và tiền cọc của chủ máy trên blockchain.
 */
contract GPURentalPlatform is Ownable, ReentrancyGuard {
    /**
     * @dev Trạng thái hiện tại của GPU trong hệ thống.
     * Available: GPU sẵn sàng cho thuê.
     * Rented: GPU đang được thuê.
     * Maintenance: GPU tạm dừng để bảo trì hoặc kiểm tra.
     */
    enum GPUStatus {
        Available,
        Rented,
        Maintenance
    }

    enum TransactionType {
        EscrowDeposited,
        RentalPaymentRecorded,
        PlatformFeeRecorded,
        RefundPaid,
        ProviderWithdrawal,
        PlatformWithdrawal,
        SlashingCompensation
    }

    /**
     * @dev Thông tin một GPU được đăng ký bởi chủ máy.
     * gpuId: ID duy nhất của GPU trong hệ thống.
     * owner: ví của chủ máy GPU, dùng payable để sau này có thể nhận tiền thuê.
     * hardwareSpec: thông số dễ đọc, ví dụ "NVIDIA RTX 4090 - 24GB VRAM - CUDA 12.4".
     * hardwareSpecHash: hash xác thực do backend tạo từ dữ liệu agent quét được.
     * pricePerHour: giá thuê GPU tính bằng wei/giờ.
     * minStakingRequired: mức staking tối thiểu tại thời điểm đăng ký GPU.
     * status: trạng thái GPU sau khi đăng ký, mặc định là Available.
     */
    struct GPU {
        uint256 gpuId;
        address payable owner;
        string hardwareSpec;
        string hardwareSpecHash;
        string metadataCID;
        uint256 pricePerHour;
        uint256 minStakingRequired;
        GPUStatus status;
    }

    /**
     * @dev Thông tin một phiên thuê GPU.
     * agreementId: ID duy nhất của hợp đồng thuê.
     * gpuId: ID GPU được thuê.
     * renter: ví của người thuê GPU.
     * startTime: thời điểm bắt đầu thuê, lấy theo block.timestamp.
     * escrowFund: số ETH người thuê nạp trước vào smart contract để trả tiền thuê.
     * isActive: đánh dấu phiên thuê còn đang hoạt động hay đã kết thúc.
     */
    struct RentalAgreement {
        uint256 agreementId;
        uint256 gpuId;
        address payable renter;
        uint256 startTime;
        uint256 escrowFund;
        bool isActive;
    }

    /**
     * @dev Gom các số liệu thanh toán cuối phiên để tránh lỗi "Stack too deep"
     * khi hàm endRentalSession vừa tính tiền, vừa chuyển ETH, vừa emit event nhiều trường.
     */
    struct RentalSettlement {
        uint256 durationSeconds;
        uint256 totalCost;
        uint256 platformFee;
        uint256 ownerPayment;
        uint256 refundAmount;
    }

    struct PlatformTransaction {
        uint256 transactionId;
        uint256 agreementId;
        uint256 gpuId;
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        TransactionType transactionType;
    }

    /// @dev Lưu thông tin GPU theo gpuId.
    mapping(uint256 => GPU) public gpus;

    /// @dev Lưu thông tin phiên thuê theo agreementId.
    mapping(uint256 => RentalAgreement) public agreements;

    mapping(uint256 => PlatformTransaction) public transactions;

    /// @dev Tổng số ETH mà mỗi chủ máy đã staking vào nền tảng.
    mapping(address => uint256) public ownerStakedBalance;

    mapping(address => uint256) public providerBalances;

    uint256 public platformBalance;

    /// @dev ID sẽ được dùng cho GPU tiếp theo. GPU đầu tiên có ID = 0.
    uint256 public nextGpuId;

    /// @dev ID sẽ được dùng cho phiên thuê tiếp theo. Agreement đầu tiên có ID = 0.
    uint256 public nextAgreementId;

    uint256 public nextTransactionId;

    /// @dev Mức staking tối thiểu để đăng ký một GPU: 0.05 ETH.
    uint256 public constant MIN_STAKE = 0.05 ether;

    /// @dev Ví admin của nền tảng, nhận phí dịch vụ khi kết thúc phiên thuê.
    address payable public platformAdmin;

    /// @dev Phí nền tảng thu 2% trên phần tiền thuê thực sự đã sử dụng.
    uint256 public constant PLATFORM_FEE_PERCENT = 2;

    /// @dev Mức phạt cố định trừ từ stake của chủ GPU khi xảy ra sự cố: 0.01 ETH.
    uint256 public constant SLASHING_PENALTY = 0.01 ether;

    /**
     * @dev Phát ra khi chủ máy đăng ký GPU thành công.
     * stakedAmount là số ETH gửi kèm trong lần gọi registerGPU này.
     */
    event GPURegistered(
        uint256 indexed gpuId,
        address indexed owner,
        string hardwareSpec,
        string hardwareSpecHash,
        uint256 pricePerHour,
        uint256 stakedAmount
    );

    event GPURegisteredWithCID(
        uint256 indexed gpuId,
        address indexed owner,
        string hardwareSpec,
        string metadataCID,
        uint256 pricePerHour,
        uint256 stakedAmount
    );

    /**
     * @dev Phát ra khi người dùng bắt đầu thuê GPU thành công.
     * escrowFund là số ETH người thuê gửi kèm giao dịch và đang được giữ trong contract.
     */
    event RentalStarted(
        uint256 indexed agreementId,
        uint256 indexed gpuId,
        address indexed renter,
        address owner,
        uint256 startTime,
        uint256 escrowFund
    );

    /**
     * @dev Phát ra khi phiên thuê GPU kết thúc và escrow được chia tiền.
     * telemetryHash là hash dữ liệu vận hành cuối phiên do backend/agent tạo.
     */
    event RentalEnded(
        uint256 indexed agreementId,
        uint256 indexed gpuId,
        address indexed renter,
        address owner,
        uint256 durationSeconds,
        uint256 totalCost,
        uint256 platformFee,
        uint256 ownerPayment,
        uint256 refundAmount,
        string telemetryHash
    );

    /**
     * @dev Phát ra khi chủ GPU bị phạt do vi phạm cam kết vận hành.
     * escrowRefunded là toàn bộ escrow còn lại được hoàn cho renter.
     */
    event SlashingExecuted(
        uint256 indexed agreementId,
        uint256 indexed gpuId,
        address indexed renter,
        address owner,
        uint256 penaltyAmount,
        uint256 escrowRefunded,
        uint256 ownerRemainingStake
    );

    /**
     * @dev OpenZeppelin Ownable phiên bản mới yêu cầu truyền initialOwner.
     * Khi deploy bằng Hardhat, ví deployer sẽ trở thành owner của contract.
     */

    event ProviderEarningsRecorded(
        uint256 indexed agreementId,
        address indexed provider,
        uint256 amount,
        uint256 newProviderBalance
    );

    event ProviderEarningsWithdrawn(
        address indexed provider,
        uint256 amount
    );

    event PlatformFeesRecorded(
        uint256 indexed agreementId,
        uint256 amount,
        uint256 newPlatformBalance
    );

    event PlatformFeesWithdrawn(
        address indexed owner,
        uint256 amount
    );

    event TransactionRecorded(
        uint256 indexed transactionId,
        uint256 indexed agreementId,
        uint256 indexed gpuId,
        address from,
        address to,
        uint256 amount,
        uint256 timestamp,
        TransactionType transactionType
    );

    constructor() Ownable(msg.sender) {
        platformAdmin = payable(msg.sender);
    }

    /**
     * @notice Đăng ký một GPU mới lên nền tảng DeCompute.
     *
     * @dev Hàm này KHÔNG quét phần cứng trực tiếp. Thông số _spec và _specHash
     * phải được tạo trước bởi backend sau khi backend nhận dữ liệu thật từ gpu-agent.js.
     *
     * Điều kiện:
     * - _spec không được rỗng.
     * - _specHash không được rỗng.
     * - _pricePerHour phải lớn hơn 0.
     * - msg.value phải >= MIN_STAKE.
     *
     * @param _spec Thông số GPU dạng chuỗi dễ đọc.
     * @param _specHash Hash xác thực thông số phần cứng do backend tạo.
     * @param _pricePerHour Giá thuê GPU tính bằng wei/giờ.
     */
    function registerGPU(
        string memory _spec,
        string memory _specHash,
        uint256 _pricePerHour
    ) external payable nonReentrant {
        // Kiểm tra thông số phần cứng không được để trống.
        require(bytes(_spec).length > 0, "Hardware spec is required");

        // Kiểm tra hash xác thực không được để trống.
        require(bytes(_specHash).length > 0, "Hardware spec hash is required");

        // Giá thuê theo giờ phải là số dương.
        require(_pricePerHour > 0, "Price per hour must be greater than zero");

        // Chủ máy phải gửi tối thiểu 0.05 ETH để staking khi đăng ký GPU.
        require(msg.value >= MIN_STAKE, "Insufficient staking amount");

        // Cộng số ETH gửi kèm vào tổng số dư staking của chủ máy.
        ownerStakedBalance[msg.sender] += msg.value;

        // Lấy ID hiện tại để gán cho GPU mới.
        uint256 gpuId = nextGpuId;

        // Tạo và lưu GPU mới vào mapping.
        gpus[gpuId] = GPU({
            gpuId: gpuId,
            owner: payable(msg.sender),
            hardwareSpec: _spec,
            hardwareSpecHash: _specHash,
            metadataCID: "",
            pricePerHour: _pricePerHour,
            minStakingRequired: MIN_STAKE,
            status: GPUStatus.Available
        });

        // Ghi log sự kiện để frontend/backend dễ theo dõi lịch sử đăng ký GPU.
        emit GPURegistered(
            gpuId,
            msg.sender,
            _spec,
            _specHash,
            _pricePerHour,
            msg.value
        );

        // Tăng ID cho lần đăng ký GPU tiếp theo.
        nextGpuId++;
    }

    /**
     * @notice Register a GPU by using an IPFS metadata CID produced by the Agent.
     * @dev The contract stores the CID only. It cannot fetch or validate IPFS
     * content by itself, so backend/agent/frontend remain responsible for
     * preparing and displaying the metadata JSON.
     */
    function registerGPUWithCID(
        string memory _spec,
        string memory _metadataCID,
        uint256 _pricePerHour
    ) external payable nonReentrant {
        require(bytes(_spec).length > 0, "Hardware spec is required");
        require(bytes(_metadataCID).length > 0, "Metadata CID is required");
        require(_pricePerHour > 0, "Price per hour must be greater than zero");
        require(msg.value >= MIN_STAKE, "Insufficient staking amount");

        ownerStakedBalance[msg.sender] += msg.value;

        uint256 gpuId = nextGpuId;

        gpus[gpuId] = GPU({
            gpuId: gpuId,
            owner: payable(msg.sender),
            hardwareSpec: _spec,
            hardwareSpecHash: _metadataCID,
            metadataCID: _metadataCID,
            pricePerHour: _pricePerHour,
            minStakingRequired: MIN_STAKE,
            status: GPUStatus.Available
        });

        emit GPURegisteredWithCID(
            gpuId,
            msg.sender,
            _spec,
            _metadataCID,
            _pricePerHour,
            msg.value
        );

        nextGpuId++;
    }

    /**
     * @notice Bắt đầu thuê một GPU đang rảnh.
     *
     * @dev Người thuê phải gửi ETH kèm giao dịch thông qua msg.value.
     * msg.value chính là số ETH nạp trước vào quỹ escrow của phiên thuê.
     * Số ETH này nằm trong balance của smart contract, chưa chuyển ngay cho chủ máy.
     *
     * Đây là cơ chế escrow/pull payment:
     * - startRental chỉ khóa tiền thuê trong contract và đánh dấu GPU là đang được thuê.
     * - Chủ máy chưa nhận tiền ở bước này để tránh trả tiền trước khi dịch vụ hoàn tất.
     * - Tiền chỉ được tính toán và chia cho renter, owner, platform khi gọi endRentalSession.
     *
     * @param _gpuId ID của GPU mà người dùng muốn thuê.
     */
    function startRental(uint256 _gpuId) external payable nonReentrant {
        // Kiểm tra GPU đã tồn tại trong hệ thống hay chưa.
        require(_gpuId < nextGpuId, "GPU does not exist");

        // Lấy GPU từ storage để có thể cập nhật trực tiếp trạng thái của GPU.
        GPU storage gpu = gpus[_gpuId];

        // Chỉ GPU đang Available mới được phép bắt đầu phiên thuê mới.
        require(gpu.status == GPUStatus.Available, "GPU is not available");

        // Chủ máy không được tự thuê GPU của chính mình để tránh tạo giao dịch giả.
        require(msg.sender != gpu.owner, "Owner cannot rent own GPU");

        // msg.value là số ETH người thuê nạp trước vào escrow của smart contract.
        require(msg.value > 0, "Escrow fund must be greater than zero");

        // Escrow tối thiểu nên đủ trả 1 giờ thuê để phiên thuê có ý nghĩa.
        require(msg.value >= gpu.pricePerHour, "Escrow must cover at least 1 hour");

        // Chuyển GPU sang trạng thái đang được thuê.
        gpu.status = GPUStatus.Rented;

        // Lấy ID hiện tại để tạo agreement mới.
        uint256 agreementId = nextAgreementId;

        // Lưu phiên thuê. ETH không nằm trong struct này theo nghĩa vật lý;
        // toàn bộ ETH đã được gửi vào balance của smart contract qua msg.value.
        // escrowFund chỉ là số liệu kế toán để biết phiên thuê này đã nạp bao nhiêu.
        agreements[agreementId] = RentalAgreement({
            agreementId: agreementId,
            gpuId: _gpuId,
            renter: payable(msg.sender),
            startTime: block.timestamp,
            escrowFund: msg.value,
            isActive: true
        });

        // Tăng ID cho phiên thuê tiếp theo.
        nextAgreementId++;

        _recordTransaction(
            agreementId,
            _gpuId,
            msg.sender,
            address(this),
            msg.value,
            TransactionType.EscrowDeposited
        );

        // Ghi log để frontend/backend dễ theo dõi phiên thuê vừa bắt đầu.
        emit RentalStarted(
            agreementId,
            _gpuId,
            msg.sender,
            gpu.owner,
            block.timestamp,
            msg.value
        );
    }

    /**
     * @notice Kết thúc một phiên thuê GPU đang hoạt động.
     *
     * @dev ETH escrow đã nằm trong balance của smart contract từ lúc startRental.
     * endRentalSession là thời điểm contract mới tính toán và chia tiền:
     * - platformAdmin nhận 2% phí nền tảng.
     * - gpu.owner nhận 98% còn lại của phần tiền thuê thực sự đã sử dụng.
     * - renter được hoàn lại phần ETH escrow chưa sử dụng.
     *
     * _telemetryHash đến từ backend/agent Node.js sau khi ghi nhận dữ liệu vận hành cuối phiên.
     * Solidity không tự tạo hash này và cũng không tự xác minh phần cứng hay telemetry.
     * Contract chỉ emit hash lên on-chain để phục vụ demo, đối soát và báo cáo đồ án.
     *
     * @param _agreementId ID của phiên thuê cần kết thúc.
     * @param _telemetryHash Hash dữ liệu giám sát cuối phiên do backend/agent tạo.
     */
    function endRentalSession(
        uint256 _agreementId,
        string memory _telemetryHash
    ) external nonReentrant {
        // Kiểm tra agreement đã tồn tại trong hệ thống hay chưa.
        require(_agreementId < nextAgreementId, "Agreement does not exist");

        // Lấy agreement và GPU từ storage để cập nhật trực tiếp trạng thái.
        RentalAgreement storage agreement = agreements[_agreementId];
        GPU storage gpu = gpus[agreement.gpuId];

        // Chỉ phiên thuê đang active mới được kết thúc.
        require(agreement.isActive, "Agreement is not active");

        // GPU của phiên này phải đang ở trạng thái Rented.
        require(gpu.status == GPUStatus.Rented, "GPU is not rented");

        // Chỉ renter, chủ GPU hoặc admin/backend oracle giả lập mới được kết thúc phiên.
        require(
            msg.sender == agreement.renter ||
                msg.sender == gpu.owner ||
                msg.sender == owner(),
            "Not authorized to end rental"
        );

        // telemetryHash là bằng chứng off-chain do backend/agent tạo.
        // Contract không kiểm chứng nội dung telemetry, chỉ ghi nhận hash on-chain.
        require(bytes(_telemetryHash).length > 0, "Telemetry hash is required");

        // Dùng giây để demo nhanh, không cần chờ đủ 1 giờ mới tính được tiền.
        RentalSettlement memory settlement;
        settlement.durationSeconds = block.timestamp - agreement.startTime;

        // Quy đổi giá thuê theo giờ sang chi phí theo giây.
        // Solidity chia số nguyên nên kết quả có thể được làm tròn xuống.
        settlement.totalCost =
            (settlement.durationSeconds * gpu.pricePerHour) /
            3600;

        // Nếu chi phí vượt quá escrow thì chỉ lấy tối đa bằng số ETH renter đã nạp.
        if (settlement.totalCost > agreement.escrowFund) {
            settlement.totalCost = agreement.escrowFund;
        }

        // platformAdmin nhận 2%, chủ GPU nhận phần còn lại của số tiền đã sử dụng.
        settlement.platformFee =
            (settlement.totalCost * PLATFORM_FEE_PERCENT) /
            100;
        settlement.ownerPayment = settlement.totalCost - settlement.platformFee;

        // Phần escrow chưa dùng được hoàn lại cho renter.
        settlement.refundAmount = agreement.escrowFund - settlement.totalCost;

        // Cập nhật state trước khi chuyển ETH để giảm rủi ro reentrancy.
        agreement.isActive = false;
        agreement.escrowFund = 0;
        gpu.status = GPUStatus.Available;
        providerBalances[gpu.owner] += settlement.ownerPayment;
        platformBalance += settlement.platformFee;

        // Pull-payment accounting: these records credit balances inside the
        // contract. ETH leaves only when the withdrawal functions are called.
        _recordTransaction(
            _agreementId,
            agreement.gpuId,
            address(this),
            gpu.owner,
            settlement.ownerPayment,
            TransactionType.RentalPaymentRecorded
        );

        _recordTransaction(
            _agreementId,
            agreement.gpuId,
            address(this),
            owner(),
            settlement.platformFee,
            TransactionType.PlatformFeeRecorded
        );

        emit ProviderEarningsRecorded(
            _agreementId,
            gpu.owner,
            settlement.ownerPayment,
            providerBalances[gpu.owner]
        );

        emit PlatformFeesRecorded(
            _agreementId,
            settlement.platformFee,
            platformBalance
        );

        _safeTransferETH(agreement.renter, settlement.refundAmount);

        _recordTransaction(
            _agreementId,
            agreement.gpuId,
            address(this),
            agreement.renter,
            settlement.refundAmount,
            TransactionType.RefundPaid
        );

        _emitRentalEnded(_agreementId, agreement, gpu, settlement, _telemetryHash);
    }

    /**
     * @notice Xử lý phạt chủ GPU khi xảy ra vi phạm hoặc sự cố trong phiên thuê.
     *
     * @dev executeSlashing là nhánh xử lý lỗi, khác với endRentalSession.
     * Trong demo, backend/admin có thể đóng vai trò oracle giả lập để xác nhận sự cố.
     * Smart contract không tự biết GPU có thật sự sập nguồn, mất kết nối hay thiếu telemetry.
     * Việc phát hiện lỗi đến từ backend/agent ngoài chuỗi hoặc từ renter báo cáo.
     *
     * Khi slash:
     * - owner mất một phần stake, tối đa SLASHING_PENALTY.
     * - renter được hoàn toàn bộ escrow còn lại và nhận thêm tiền bồi thường.
     * - GPU chuyển sang Maintenance để không cho thuê tiếp cho đến khi được xử lý.
     *
     * @param _agreementId ID của phiên thuê cần xử lý slashing.
     */
    function executeSlashing(uint256 _agreementId) external nonReentrant {
        // Kiểm tra agreement đã tồn tại trong hệ thống hay chưa.
        require(_agreementId < nextAgreementId, "Agreement does not exist");

        // Lấy agreement và GPU từ storage để cập nhật trực tiếp trạng thái.
        RentalAgreement storage agreement = agreements[_agreementId];
        GPU storage gpu = gpus[agreement.gpuId];

        // Chỉ phiên thuê đang active mới có thể bị slash.
        require(agreement.isActive, "Agreement is not active");

        // Slashing chỉ áp dụng cho GPU đang được thuê.
        require(gpu.status == GPUStatus.Rented, "GPU is not rented");

        // Chỉ renter hoặc admin/backend oracle giả lập được gọi slashing.
        // Không cho chủ GPU tự slash chính mình.
        require(
            msg.sender == agreement.renter || msg.sender == owner(),
            "Not authorized to slash"
        );

        // Nếu stake hiện tại không đủ mức phạt cố định, chỉ phạt phần stake còn lại.
        // Cách xử lý mềm này giúp demo không bị revert khi stake thấp hơn 0.01 ETH.
        uint256 currentStake = ownerStakedBalance[gpu.owner];
        uint256 penaltyAmount = SLASHING_PENALTY;

        if (penaltyAmount > currentStake) {
            penaltyAmount = currentStake;
        }

        // Slashing là sự cố, nên hoàn toàn bộ escrow còn lại cho renter.
        uint256 escrowRefunded = agreement.escrowFund;
        uint256 totalCompensation = penaltyAmount + escrowRefunded;

        // Cập nhật state trước khi chuyển ETH để chống reentrancy.
        ownerStakedBalance[gpu.owner] = currentStake - penaltyAmount;
        agreement.escrowFund = 0;
        agreement.isActive = false;
        gpu.status = GPUStatus.Maintenance;

        // Renter nhận tiền bồi thường từ stake của owner cộng với escrow được hoàn.
        // Dùng _safeTransferETH để chuyển bằng call, không dùng transfer.
        _safeTransferETH(agreement.renter, totalCompensation);

        _recordTransaction(
            _agreementId,
            agreement.gpuId,
            gpu.owner,
            agreement.renter,
            totalCompensation,
            TransactionType.SlashingCompensation
        );

        emit SlashingExecuted(
            _agreementId,
            agreement.gpuId,
            agreement.renter,
            gpu.owner,
            penaltyAmount,
            escrowRefunded,
            ownerStakedBalance[gpu.owner]
        );
    }

    function withdrawProviderEarnings() external nonReentrant {
        uint256 amount = providerBalances[msg.sender];
        require(amount > 0, "No provider earnings to withdraw");

        providerBalances[msg.sender] = 0;
        _safeTransferETH(payable(msg.sender), amount);

        _recordTransaction(
            0,
            0,
            address(this),
            msg.sender,
            amount,
            TransactionType.ProviderWithdrawal
        );

        emit ProviderEarningsWithdrawn(msg.sender, amount);
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = platformBalance;
        require(amount > 0, "No platform fees to withdraw");

        platformBalance = 0;
        _safeTransferETH(payable(owner()), amount);

        _recordTransaction(
            0,
            0,
            address(this),
            owner(),
            amount,
            TransactionType.PlatformWithdrawal
        );

        emit PlatformFeesWithdrawn(owner(), amount);
    }

    function getProviderBalance(address provider) external view returns (uint256) {
        return providerBalances[provider];
    }

    function getPlatformBalance() external view returns (uint256) {
        return platformBalance;
    }

    /**
     * @notice Đọc thông tin GPU theo ID.
     * @param _gpuId ID của GPU cần đọc.
     * @return Thông tin GPU đầy đủ dưới dạng struct.
     */
    function getGPU(uint256 _gpuId) external view returns (GPU memory) {
        require(_gpuId < nextGpuId, "GPU does not exist");
        return gpus[_gpuId];
    }

    function getAllGPUs() external view returns (GPU[] memory) {
        GPU[] memory result = new GPU[](nextGpuId);

        for (uint256 i = 0; i < nextGpuId; i++) {
            result[i] = gpus[i];
        }

        return result;
    }

    /**
     * @notice Đọc thông tin một phiên thuê theo ID.
     * @param _agreementId ID của phiên thuê cần đọc.
     * @return Thông tin phiên thuê đầy đủ dưới dạng struct.
     */
    function getAgreement(uint256 _agreementId)
        external
        view
        returns (RentalAgreement memory)
    {
        require(_agreementId < nextAgreementId, "Agreement does not exist");
        return agreements[_agreementId];
    }

    function _recordTransaction(
        uint256 _agreementId,
        uint256 _gpuId,
        address _from,
        address _to,
        uint256 _amount,
        TransactionType _transactionType
    ) internal {
        uint256 transactionId = nextTransactionId;
        uint256 timestamp = block.timestamp;

        transactions[transactionId] = PlatformTransaction({
            transactionId: transactionId,
            agreementId: _agreementId,
            gpuId: _gpuId,
            from: _from,
            to: _to,
            amount: _amount,
            timestamp: timestamp,
            transactionType: _transactionType
        });

        emit TransactionRecorded(
            transactionId,
            _agreementId,
            _gpuId,
            _from,
            _to,
            _amount,
            timestamp,
            _transactionType
        );

        nextTransactionId++;
    }

    /**
     * @dev Tách emit event ra helper riêng để tránh lỗi "Stack too deep"
     * trong hàm endRentalSession khi event có nhiều trường dữ liệu.
     */
    function _emitRentalEnded(
        uint256 _agreementId,
        RentalAgreement storage _agreement,
        GPU storage _gpu,
        RentalSettlement memory _settlement,
        string memory _telemetryHash
    ) internal {
        emit RentalEnded(
            _agreementId,
            _agreement.gpuId,
            _agreement.renter,
            _gpu.owner,
            _settlement.durationSeconds,
            _settlement.totalCost,
            _settlement.platformFee,
            _settlement.ownerPayment,
            _settlement.refundAmount,
            _telemetryHash
        );
    }

    /**
     * @dev Chuyển ETH an toàn bằng call.
     * Không dùng transfer vì transfer bị giới hạn gas stipend 2300 gas,
     * có thể làm giao dịch thất bại khi ví nhận là smart contract cần nhiều gas hơn.
     */
    function _safeTransferETH(address payable _to, uint256 _amount) internal {
        if (_amount > 0) {
            (bool success, ) = _to.call{value: _amount}("");
            require(success, "ETH transfer failed");
        }
    }
}
