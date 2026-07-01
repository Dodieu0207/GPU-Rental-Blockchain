"use client";

import type { Rental } from "@/lib/types";
import { formatDateTime, formatDuration, secondsRemaining, shortenAddress, shortenCid } from "@/lib/format";

type Props = {
  rental: Rental;
  timerTick?: number;
  isStopping?: boolean;
  onStop: (rental: Rental) => void;
  onDetails: (rental: Rental) => void;
};

export function RentalCard({ rental, timerTick: _timerTick, isStopping, onStop, onDetails }: Props) {
  const running = rental.status === "running";
  const canEnd = rental.status === "running" || rental.status === "pending";
  const remaining = secondsRemaining(rental.rentalEndTime);
  const displayStatus = running && remaining <= 0 ? "expired - reload" : rental.status;
  const sshCommand = rental.accessInfo?.sshCommand;

  const copyText = async (text?: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  return (
    <article className="rounded-lg bg-white p-5 text-ink shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{rental.gpuName}</h2>
          {rental.gpu ? <p className="mt-1 text-sm text-gray-600">{rental.gpu.os} · {rental.gpu.gpu} · CUDA {rental.gpu.cuda}</p> : null}
          <p className="mt-1 text-sm text-gray-600">Provider {shortenAddress(rental.provider)}</p>
          <p className="mt-1 text-sm text-gray-600">Rental ID {rental.id}</p>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold capitalize text-violet-700">
          {displayStatus}
        </span>
      </div>
      <div className="mt-5 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <p>Started: <span className="font-semibold text-ink">{formatDateTime(rental.startedAt)}</span></p>
        <p>Duration: <span className="font-semibold text-ink">{formatDuration(rental.durationSeconds)}</span></p>
        <p>Remaining: <span className="font-semibold text-ink">{formatDuration(remaining)}</span></p>
        <p>Price/hour: <span className="font-semibold text-ink">{rental.priceEth || "On-chain"} ETH</span></p>
        <p>Escrow: <span className="font-semibold text-ink">{rental.escrowAmount || "On-chain"} ETH</span></p>
        <p>CID: <span className="font-semibold text-ink">{shortenCid(rental.cid)}</span></p>
        <p>Container: <span className="font-semibold text-ink">{rental.containerStatus ?? "Not reported"}</span></p>
        <p>Session: <span className="font-semibold text-ink">{rental.accessInfo?.sessionId || rental.id}</span></p>
      </div>
      {!rental.accessInfo || rental.containerStatus === "agent-bypassed" || rental.status === "pending" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Agent is not connected or container was not started. You can end this pending rental to release the GPU.
        </div>
      ) : null}
      {rental.sandboxEndpoint ? (
        <a
          href={rental.sandboxEndpoint}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Open Sandbox
        </a>
      ) : null}
      {rental.accessInfo ? (
        <div className="mt-4 rounded-md border border-line bg-gray-50 p-3 text-sm">
          <p className="font-semibold text-ink">SSH Access</p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2">{sshCommand}</code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(sshCommand)}
              className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
            >
              Copy SSH Command
            </button>
            <button
              type="button"
              onClick={() => copyText(rental.accessInfo?.password)}
              className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
            >
              Copy Password
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Password: {rental.accessInfo.password}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onDetails(rental)}
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          More Info
        </button>
        <button
          type="button"
          onClick={() => onStop(rental)}
          disabled={!canEnd || isStopping}
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isStopping ? "Stopping..." : "End Rental"}
        </button>
      </div>
    </article>
  );
}
