# DeCompute Backend Demo

Minimal Node.js backend for the student DePIN flow.

## Run

```bash
node server.js
```

## Main APIs

- `POST /api/provider/gpus`: provider registers a GPU metadata CID.
- `GET /api/gpus`: tenant/frontend browses registered GPUs.
- `POST /api/rentals`: tenant starts a rental; backend calls Agent `startRental`.
- `POST /api/rentals/:id/stop`: tenant/backend stops a rental; backend calls Agent `stopRental`.
- `GET /api/rentals`: list demo rentals.
- `POST /api/transactions/sync-event`: index one or more `TransactionRecorded` on-chain events.
- `GET /api/transactions`: list cached on-chain transactions; supports `walletAddress`, `agreementId`, and `gpuId` query params.

Provider-only endpoints expect:

```text
X-User-Role: provider
X-User-Id: provider-demo
```

Tenant-only endpoints expect:

```text
X-User-Role: tenant
X-User-Id: tenant-demo
```
