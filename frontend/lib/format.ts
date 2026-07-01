export function shortenAddress(address: string) {
  if (!address) return "Not available";
  if (!address.startsWith("0x") || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenCid(cid?: string) {
  if (!cid) return "No CID";
  return `${cid.slice(0, 10)}...${cid.slice(-6)}`;
}

export function formatEthFromWei(value?: string) {
  if (!value) return "0";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return (numeric / 1e18).toString();
}

export function formatDateTime(value?: string | number) {
  if (!value) return "Not available";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export function secondsRemaining(endTime?: string) {
  if (!endTime) return 0;
  return Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
