type StatusMessageProps = {
  type: "info" | "success" | "error" | "warning";
  children: React.ReactNode;
};

const styles = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export function StatusMessage({ type, children }: StatusMessageProps) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${styles[type]}`}>
      {children}
    </div>
  );
}
