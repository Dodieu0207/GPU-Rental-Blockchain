# DeCompute GPU Rental Platform

DeCompute connects GPU Owners with Tenants who need short-term GPU compute.

## Roles

- Host / GPU Owner: installs and runs `gpu-agent.js` on the GPU machine.
- Tenant / Renter: does not install the Agent. Tenants browse GPUs, rent, pay with Sepolia ETH, and use the sandbox/session URL.

## Host Agent

The Agent is required only for GPU Owners. It:

- scans GPU hardware with `nvidia-smi`
- creates GPU metadata JSON
- uploads metadata to IPFS/Pinata, or mock IPFS for demo
- prints a CID for GPU registration
- runs as a server for backend commands: `startRental`, `stopRental`, `getStatus`, `heartbeat`
- creates/stops Docker containers when rental sessions start/end

Create metadata CID:

```bash
node gpu-agent.js upload
```

Run Agent server:

```bash
node gpu-agent.js serve
```

Default Agent URL:

```text
http://localhost:7000
```

Keep this process running while your GPU is listed as available.

Docker real mode is optional/demo advanced:

```bash
AGENT_DOCKER_MODE=real node gpu-agent.js serve
```

Real Docker GPU sessions require Docker and NVIDIA Container Toolkit.
