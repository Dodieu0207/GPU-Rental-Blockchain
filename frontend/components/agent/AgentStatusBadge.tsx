type AgentStatusBadgeProps = {
  status: string;
};

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const normalized = status.toLowerCase();
  const isConnected = normalized.includes("connected") || normalized.includes("ready");
  const isError = normalized.includes("failed") || normalized.includes("not") || normalized.includes("error");

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isConnected
          ? "bg-emerald-50 text-emerald-700"
          : isError
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}
