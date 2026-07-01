const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { after, before, describe, it } = require('node:test');

let tempDir;
let backend;

function jsonRequest(body, headers = {}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.headers = headers;
  return request;
}

describe('backend wallet and transaction indexing', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'decompute-backend-test-'));
    process.env.DATA_DIR = tempDir;
    process.env.CONTRACT_ADDRESS = '0x9999999999999999999999999999999999999999';
    process.env.CHAIN_ID = '31337';
    backend = require('../backend/server.js');
  });

  after(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('connect wallet lowercases addresses and does not create duplicate users', async () => {
    const walletAddress = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
    const first = await backend.connectWallet(jsonRequest({ walletAddress, role: 'renter', userId: 'alice' }));
    const second = await backend.connectWallet(jsonRequest({ walletAddress: walletAddress.toLowerCase(), role: 'provider' }));
    const db = await backend.readDb();

    assert.equal(first.walletAddress, walletAddress.toLowerCase());
    assert.equal(second.walletAddress, walletAddress.toLowerCase());
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].role, 'provider');
  });

  it('syncs TransactionRecorded events without duplicates and supports wallet queries', async () => {
    const event = {
      chainId: '31337',
      contractAddress: '0x9999999999999999999999999999999999999999',
      transactionId: 7n,
      agreementId: 3n,
      gpuId: 2n,
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      amount: 123n,
      timestamp: 1710000000n,
      transactionType: 1,
      txHash: '0xabc',
      blockNumber: 55,
      logIndex: 4,
    };

    await backend.upsertTransactionFromEvent(event);
    await backend.upsertTransactionFromEvent({ ...event, amount: 123n });

    const db = await backend.readDb();
    assert.equal(db.transactions.length, 1);
    assert.equal(db.transactions[0].transactionType, 'RentalPaymentRecorded');
    assert.equal(db.transactions[0].amount, '123');
    assert.equal(db.transactions[0].from, event.from);
    assert.equal(db.transactions[0].to, event.to);
    assert.equal(db.transactions[0].txHash, '0xabc');
    assert.equal(db.transactions[0].blockNumber, 55);
    assert.equal(db.transactions[0].logIndex, 4);

    assert.equal(db.transactions[0].user, undefined);
    assert.equal(db.transactions[0].profile, undefined);
    assert.equal(db.transactions[0].avatar, undefined);
    assert.equal(db.transactions[0].role, undefined);

    const query = new URLSearchParams({ walletAddress: event.to.toUpperCase() });
    const results = backend.filterTransactions(db.transactions, query);
    assert.equal(results.length, 1);
    assert.equal(results[0].transactionId, '7');
  });
});
