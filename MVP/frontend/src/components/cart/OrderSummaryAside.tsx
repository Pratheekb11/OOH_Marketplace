import type { ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import type { CartOut } from "@/types/api";

export interface OrderSummaryAsideProps {
  cart: CartOut;
  /** Slot for the page-specific primary action (e.g. "Proceed to Checkout"
   * on /cart; omitted on /checkout, where DummyPaymentForm owns the CTA). */
  cta?: ReactNode;
  className?: string;
}

/**
 * Ported from checkout_page.html's sticky "Order Summary" aside. Renders
 * exactly the four server-computed totals — never sums `cart.items`
 * client-side (float rounding means sum(rounded) != round(sum)).
 */
export function OrderSummaryAside({ cart, cta, className = "" }: OrderSummaryAsideProps) {
  return (
    <aside className={`lg:sticky lg:top-28 ${className}`}>
      <div className="relative overflow-hidden rounded-xl bg-primary-container p-8 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <h3 className="relative z-10 mb-8 font-headline text-2xl font-extrabold">Order Summary</h3>
        <div className="relative z-10 space-y-4 text-sm">
          <div className="flex items-center justify-between text-on-primary-container">
            <span>Subtotal</span>
            <Money value={cart.subtotal} mode="full" className="font-bold text-white" />
          </div>
          {cart.addons_total > 0 ? (
            <div className="flex items-center justify-between text-on-primary-container">
              <span>Add-ons</span>
              <Money value={cart.addons_total} mode="full" className="font-bold text-white" />
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-secondary">GST (18%)</span>
              <span className="text-xs text-on-primary-container">Statutory tax</span>
            </div>
            <Money value={cart.gst_total} mode="full" className="font-bold text-white" />
          </div>
          <div className="flex items-end justify-between pt-6">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-on-primary-container">Total Payable</p>
              <Money value={cart.grand_total} mode="full" className="font-headline text-3xl font-extrabold" />
            </div>
            <span className="mb-2 text-xs text-on-primary-container">INR</span>
          </div>
        </div>

        {cta ? <div className="relative z-10 mt-8">{cta}</div> : null}

        <div className="relative z-10 mt-8 flex items-start gap-3 rounded-lg bg-white/5 p-4">
          <Icon name="shield" className="!text-xl text-secondary-container" />
          <p className="text-xs leading-relaxed text-on-primary-container">
            Simulated checkout — no real payment gateway, no card data leaves your browser. All bookings are subject
            to availability at the time of final confirmation.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default OrderSummaryAside;
