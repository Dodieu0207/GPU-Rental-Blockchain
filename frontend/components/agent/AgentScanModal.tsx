"use client";

import { useState } from "react";
import { saveGpuMetadata, scanAgent } from "@/lib/api";

type ScanStatus = "idle" | "scanning" | "creating" | "finished" | "failed";

type AgentScanModalProps = {
  agentUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onCidReady: (cid: string) => void;
  onMetadataReady?: (metadata: Record<string, unknown>) => void;
};

export function AgentScanModal({
  agentUrl,
  isOpen,
  onClose,
  onCidReady,
  onMetadataReady,
}: AgentScanModalProps) {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [cid, setCid] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const statusText =
    status === "scanning"
      ? "Scanning..."
      : status === "creating"
        ? "Creating CID..."
        : status === "finished"
          ? "Finished!"
          : status === "failed"
            ? "Scan failed"
            : "Ready to scan";

  const handleScan = async () => {
    setError("");
    setCid("");
    setCopied(false);
    setStatus("scanning");

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStatus("creating");
      const result = await scanAgent(agentUrl);

      if (!result.cid) {
        throw new Error("Agent did not return a CID.");
      }

      setCid(result.cid);
      const metadata = result.metadataRaw ?? result.metadata;
      await saveGpuMetadata(result.cid, metadata).catch(() => undefined);
      onCidReady(result.cid);
      onMetadataReady?.(metadata);
      setStatus("finished");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not scan machine.");
      setStatus("failed");
    }
  };

  const handleCopy = async () => {
    if (!cid) return;
    await navigator.clipboard.writeText(cid);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <section className="w-full max-w-xl rounded-lg bg-white p-6 text-ink shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">DeCompute Agent Scanner</h2>
            <p className="mt-2 text-sm text-gray-600">
              Make sure the DeCompute Agent is downloaded and running on this machine.
              The agent will scan your GPU specs, create metadata, upload it to IPFS,
              and return a CID for GPU registration.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-md border border-line bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-500">Status</p>
          <p className="mt-1 text-lg font-bold">{statusText}</p>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        {status === "finished" && cid ? (
          <div className="mt-5 rounded-md border border-line p-4">
            <p className="text-sm font-semibold text-gray-500">CID</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-md bg-gray-100 px-3 py-2 text-sm">
                {cid}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                {copied ? "Copied!" : "Copy CID"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleScan}
            disabled={status === "scanning" || status === "creating"}
            className="rounded-md bg-[#12091f] px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {status === "failed" ? "Retry" : "Scan"}
          </button>
          {status === "finished" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Use CID in Register GPU
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
