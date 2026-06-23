# DeCompute Frontend MVP

Next.js MVP for GPU Rental Blockchain demo.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Contract setup

1. Copy `.env.local.example` to `.env.local`.
2. Replace `NEXT_PUBLIC_CONTRACT_ADDRESS` with the deployed Sepolia contract address.
3. Paste the real contract ABI in `lib/contractAbi.ts`.
4. If your function names are different, update:
   - `NEXT_PUBLIC_GET_GPUS_FUNCTION`
   - `NEXT_PUBLIC_RENT_GPU_FUNCTION`

The current placeholders assume:

- `getAllGPUs()` returns an array of GPUs.
- `rentGPU(uint256 gpuId)` starts a rental transaction.
