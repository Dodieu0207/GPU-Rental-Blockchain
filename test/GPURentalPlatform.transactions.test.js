import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { ethers } from 'ethers';

const rpcUrl = 'http://127.0.0.1:8545';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
let hardhatNode;
let provider;
let accounts;

async function waitForNode() {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error('Hardhat node did not start in time.');
}

async function deployPlatform() {
  const artifact = JSON.parse(
    await readFile(new URL('../artifacts/contracts/GPURentalPlatform.sol/GPURentalPlatform.json', import.meta.url), 'utf8'),
  );
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, accounts[0]);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function registerGpu(contract, providerSigner, pricePerHour) {
  const tx = await contract
    .connect(providerSigner)
    .registerGPUWithCID('NVIDIA RTX 4090 - 24GB VRAM', 'ipfs-test-cid', pricePerHour, {
      value: ethers.parseEther('0.05'),
    });
  await tx.wait();
}

async function increaseTime(seconds) {
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);
}

describe('GPURentalPlatform transaction history', () => {
  before(async () => {
    hardhatNode = spawn('cmd.exe', ['/c', 'npx.cmd', 'hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8545'], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    await waitForNode();
    accounts = await Promise.all([0, 1, 2].map((index) => provider.getSigner(index)));
  });

  after(() => {
    hardhatNode?.kill();
  });

  it('records escrow, settlement, provider withdrawal, and platform withdrawal transactions', async () => {
    const [owner, gpuOwner, renter] = accounts;
    const contract = await deployPlatform();
    const pricePerHour = ethers.parseEther('0.36');
    const escrowAmount = ethers.parseEther('0.36');

    await registerGpu(contract, gpuOwner, pricePerHour);

    const startTx = await contract.connect(renter).startRental(0, { value: escrowAmount });
    const startReceipt = await startTx.wait();
    const startBlock = await provider.getBlock(startReceipt.blockNumber);
    const escrowRecord = await contract.transactions(0);

    assert.equal(await contract.nextTransactionId(), 1n);
    assert.equal(escrowRecord.transactionId, 0n);
    assert.equal(escrowRecord.agreementId, 0n);
    assert.equal(escrowRecord.gpuId, 0n);
    assert.equal(escrowRecord.from, await renter.getAddress());
    assert.equal(escrowRecord.to, await contract.getAddress());
    assert.equal(escrowRecord.amount, escrowAmount);
    assert.equal(escrowRecord.timestamp, BigInt(startBlock.timestamp));
    assert.equal(escrowRecord.transactionType, 0n);

    await increaseTime(100);
    const endTx = await contract.connect(owner).endRentalSession(0, 'telemetry-hash');
    const endReceipt = await endTx.wait();
    const endBlock = await provider.getBlock(endReceipt.blockNumber);
    const durationSeconds = BigInt(endBlock.timestamp) - escrowRecord.timestamp;
    const totalCost = (durationSeconds * pricePerHour) / 3600n;
    const platformFee = (totalCost * 2n) / 100n;
    const ownerPayment = totalCost - platformFee;
    const refundAmount = escrowAmount - totalCost;

    const rentalPayment = await contract.transactions(1);
    const platformFeeRecord = await contract.transactions(2);
    const refund = await contract.transactions(3);

    assert.equal(rentalPayment.transactionType, 1n);
    assert.equal(rentalPayment.from, await contract.getAddress());
    assert.equal(rentalPayment.to, await gpuOwner.getAddress());
    assert.equal(rentalPayment.amount, ownerPayment);
    assert.equal(rentalPayment.timestamp, BigInt(endBlock.timestamp));
    assert.equal(rentalPayment.agreementId, 0n);
    assert.equal(rentalPayment.gpuId, 0n);

    assert.equal(platformFeeRecord.transactionType, 2n);
    assert.equal(platformFeeRecord.from, await contract.getAddress());
    assert.equal(platformFeeRecord.to, await owner.getAddress());
    assert.equal(platformFeeRecord.amount, platformFee);
    assert.equal(platformFeeRecord.timestamp, BigInt(endBlock.timestamp));

    assert.equal(refund.transactionType, 3n);
    assert.equal(refund.from, await contract.getAddress());
    assert.equal(refund.to, await renter.getAddress());
    assert.equal(refund.amount, refundAmount);
    assert.equal(refund.timestamp, BigInt(endBlock.timestamp));

    const providerWithdrawTx = await contract.connect(gpuOwner).withdrawProviderEarnings();
    const providerWithdrawReceipt = await providerWithdrawTx.wait();
    const providerWithdrawBlock = await provider.getBlock(providerWithdrawReceipt.blockNumber);
    const providerWithdrawal = await contract.transactions(4);

    assert.equal(providerWithdrawal.transactionType, 4n);
    assert.equal(providerWithdrawal.from, await contract.getAddress());
    assert.equal(providerWithdrawal.to, await gpuOwner.getAddress());
    assert.equal(providerWithdrawal.amount, ownerPayment);
    assert.equal(providerWithdrawal.timestamp, BigInt(providerWithdrawBlock.timestamp));

    const platformWithdrawTx = await contract.connect(owner).withdrawPlatformFees();
    const platformWithdrawReceipt = await platformWithdrawTx.wait();
    const platformWithdrawBlock = await provider.getBlock(platformWithdrawReceipt.blockNumber);
    const platformWithdrawal = await contract.transactions(5);

    assert.equal(platformWithdrawal.transactionType, 5n);
    assert.equal(platformWithdrawal.from, await contract.getAddress());
    assert.equal(platformWithdrawal.to, await owner.getAddress());
    assert.equal(platformWithdrawal.amount, platformFee);
    assert.equal(platformWithdrawal.timestamp, BigInt(platformWithdrawBlock.timestamp));
    assert.equal(await contract.nextTransactionId(), 6n);
  });

  it('records slashing compensation transactions', async () => {
    const [owner, gpuOwner, renter] = accounts;
    const contract = await deployPlatform();
    const pricePerHour = ethers.parseEther('0.1');
    const escrowAmount = ethers.parseEther('0.1');

    await registerGpu(contract, gpuOwner, pricePerHour);
    await (await contract.connect(renter).startRental(0, { value: escrowAmount })).wait();

    const slashTx = await contract.connect(owner).executeSlashing(0);
    const slashReceipt = await slashTx.wait();
    const slashBlock = await provider.getBlock(slashReceipt.blockNumber);
    const slashing = await contract.transactions(1);

    assert.equal(slashing.transactionType, 6n);
    assert.equal(slashing.agreementId, 0n);
    assert.equal(slashing.gpuId, 0n);
    assert.equal(slashing.from, await gpuOwner.getAddress());
    assert.equal(slashing.to, await renter.getAddress());
    assert.equal(slashing.amount, escrowAmount + ethers.parseEther('0.01'));
    assert.equal(slashing.timestamp, BigInt(slashBlock.timestamp));
  });
});
