export default function GuidesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          User Guide
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">How to Use DeCompute</h1>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Tenant: How to Rent</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Login and connect MetaMask.</li>
            <li>Switch to Sepolia.</li>
            <li>Browse available GPUs.</li>
            <li>Enter rental hours and confirm transaction.</li>
            <li>Manage the active rental from Active Rentals.</li>
          </ol>
        </article>
        <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Host: How to Host</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Choose Host role.</li>
            <li>Add GPU machine information.</li>
            <li>Set hourly price and enable rental.</li>
            <li>Track active rentals and earnings.</li>
            <li>Withdraw earnings when available.</li>
          </ol>
        </article>
      </div>
    </section>
  );
}
