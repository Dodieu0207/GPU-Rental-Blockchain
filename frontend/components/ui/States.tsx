type StateProps = {
  title: string;
  message?: string;
  action?: React.ReactNode;
};

export function LoadingState({ title = "Loading" }: Partial<StateProps>) {
  return (
    <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
      <p className="text-sm font-semibold text-violet-700">{title}</p>
    </div>
  );
}

export function EmptyState({ title, message, action }: StateProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white p-8 text-center text-ink shadow-soft">
      <h2 className="text-xl font-bold">{title}</h2>
      {message ? <p className="mt-2 text-sm text-gray-600">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, message, action }: StateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
      <h2 className="font-bold">{title}</h2>
      {message ? <p className="mt-1 text-sm">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function WalletNotConnected() {
  return (
    <EmptyState
      title="Wallet not connected"
      message="Connect MetaMask to run blockchain actions and sync your profile."
    />
  );
}
