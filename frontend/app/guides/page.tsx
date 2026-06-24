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
          <h2 className="text-xl font-bold text-ink">Tenant: Rent GPU Compute</h2>
          <p className="mt-2 text-sm text-gray-600">
            Tenants do not install the Agent. They only connect MetaMask, pay on
            Sepolia, and use the sandbox/session URL returned by the system.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Choose Renter role and connect MetaMask.</li>
            <li>Switch MetaMask to Sepolia.</li>
            <li>Browse available GPUs in Marketplace.</li>
            <li>Enter rental hours and confirm the payment transaction.</li>
            <li>Open the sandbox/session URL from Active Rentals.</li>
            <li>Stop the rental when finished.</li>
          </ol>
        </article>

        <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Host: List a GPU</h2>
          <p className="mt-2 text-sm text-gray-600">
            Hosts must run the Agent on the GPU machine. The Agent scans hardware,
            uploads metadata to IPFS/Pinata or mock IPFS, and receives rental commands.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Choose Provider role and connect MetaMask.</li>
            <li>Download Agent from the Host page.</li>
            <li>
              Run <code className="rounded bg-gray-100 px-1">node gpu-agent.js upload</code>.
            </li>
            <li>Copy the generated CID.</li>
            <li>Paste the CID into the Register GPU form and set price per hour.</li>
            <li>
              Run <code className="rounded bg-gray-100 px-1">node gpu-agent.js serve</code>.
            </li>
            <li>Keep the Agent server running while the GPU is available.</li>
            <li>Withdraw earnings from My Earnings after rentals complete.</li>
          </ol>
        </article>
      </div>
    </section>
  );
}
