import { PaymentPanel } from "@/components/payment/PaymentPanel";
import { WalletStatusPanel } from "@/components/wallet/WalletStatusPanel";

export default function PaymentsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Payment Module
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Balances and Earnings</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Tenant can deposit ETH. Host can view balance and withdraw earnings.
          Contract calls are placeholders until payment ABI is connected.
        </p>
      </div>
      <WalletStatusPanel />
      <PaymentPanel />
    </section>
  );
}
