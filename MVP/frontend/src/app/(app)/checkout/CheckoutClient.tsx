"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Stepper from "@/components/ui/Stepper";
import CartItemRow from "@/components/cart/CartItemRow";
import OrderSummaryAside from "@/components/cart/OrderSummaryAside";
import ConfirmationPanel from "@/components/checkout/ConfirmationPanel";
import DummyPaymentForm from "@/components/checkout/DummyPaymentForm";
import { api, ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import type { AddonOut } from "@/components/marketplace/types";
import type { CheckoutOut } from "@/types/api";

const STEPS = [
  { label: "Step 01", title: "Summary" },
  { label: "Step 02", title: "Services" },
  { label: "Step 03", title: "Payment" },
];

/**
 * Reads `?payment=` and nothing else, isolated behind a local <Suspense>
 * (same idiom as (auth)/login/LoginForm's NextParamSync) — without a
 * boundary above any `useSearchParams()` read, `next build` hard-fails with
 * "useSearchParams() should be wrapped in a suspense boundary."
 */
function PaymentParamSync({ onResolved }: { onResolved: (id: number | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const raw = searchParams.get("payment");
    const parsed = raw ? Number(raw) : NaN;
    onResolved(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }, [searchParams, onResolved]);
  return null;
}

/** Steps 1-2 (dates + add-ons) already happened on /cart; this page is
 * always "Step 03 / Payment" — booking summary below is read-only. */
function CheckoutForm() {
  const router = useRouter();
  const { cart, loading, forbidden, refetch } = useCart();
  const [addons, setAddons] = useState<AddonOut[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [addonsUnavailable, setAddonsUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<AddonOut[]>("/addons")
      .then((data) => {
        if (!cancelled) setAddons(data);
      })
      .catch(() => {
        if (!cancelled) setAddonsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setAddonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // An empty cart means there's nothing to check out — bounce to /cart. Once
  // `hasPaid` flips (checkout succeeded and emptied the server-side cart)
  // this must stop firing, or the refetch it triggers races the
  // `router.replace(?payment=)` navigation and can flash /cart before the
  // confirmation view mounts.
  useEffect(() => {
    if (!loading && !forbidden && !hasPaid && cart.items.length === 0 && !submitting) {
      router.replace("/cart");
    }
  }, [loading, forbidden, hasPaid, cart.items.length, submitting, router]);

  async function handlePay(methodLabel: string) {
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const result = await api<CheckoutOut>("/checkout", {
        method: "POST",
        body: JSON.stringify({ method_label: methodLabel }),
      });
      setHasPaid(true);
      window.dispatchEvent(new Event("cart:changed"));
      router.replace(`/checkout?payment=${result.payment_id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCheckoutError(
          typeof err.detail === "string" ? err.detail : "Some of these dates were just taken by another booking.",
        );
        setBlocked(true);
        void refetch();
      } else {
        setCheckoutError("Something went wrong completing your payment. Please try again.");
      }
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        icon="storefront"
        title="Checkout is for advertiser accounts"
        description="You're signed in as a space owner. Sign in with an advertiser account to check out."
      />
    );
  }

  if (loading && cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (cart.items.length === 0) {
    // Redirect effect above is about to send us to /cart.
    return null;
  }

  return (
    <>
      <Stepper steps={STEPS} currentIndex={2} className="mb-16" />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
        <div className="space-y-10 lg:col-span-7">
          <section>
            <h2 className="mb-6 font-headline text-2xl font-extrabold tracking-tight">Booking Summary</h2>
            <div className="space-y-6">
              {cart.items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  addons={addons}
                  addonsLoading={addonsLoading}
                  addonsUnavailable={addonsUnavailable}
                  readOnly
                  onChanged={() => void refetch()}
                />
              ))}
            </div>
          </section>

          {blocked ? (
            <div className="rounded-xl bg-error-container p-6">
              <p className="font-bold text-on-error-container">{checkoutError}</p>
              <p className="mt-2 text-sm text-on-error-container">
                Fix the affected dates in your cart, then come back to pay.
              </p>
              <Button variant="outline" href="/cart" className="mt-4">
                Back to cart
              </Button>
            </div>
          ) : (
            <section>
              <h2 className="mb-6 font-headline text-2xl font-extrabold tracking-tight">Payment</h2>
              <DummyPaymentForm submitting={submitting} error={checkoutError} onSubmit={handlePay} />
            </section>
          )}
        </div>

        <OrderSummaryAside cart={cart} className="lg:col-span-5" />
      </div>
    </>
  );
}

function CheckoutContent() {
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);

  function handleResolved(id: number | null) {
    setPaymentId(id);
    setResolved(true);
  }

  return (
    <>
      <Suspense fallback={null}>
        <PaymentParamSync onResolved={handleResolved} />
      </Suspense>
      {!resolved ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : paymentId ? (
        <ConfirmationPanel paymentId={paymentId} />
      ) : (
        <CheckoutForm />
      )}
    </>
  );
}

/** Client page: `RequireAuth` bounces an anonymous visitor to
 * `/login?next=/checkout`. */
export function CheckoutClient() {
  return (
    <RequireAuth>
      <main className="container mx-auto flex-grow px-6 py-12 font-inter lg:px-12">
        <CheckoutContent />
      </main>
    </RequireAuth>
  );
}

export default CheckoutClient;
