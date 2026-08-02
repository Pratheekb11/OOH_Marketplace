import Skeleton from "@/components/ui/Skeleton";

/**
 * Fixed-size fallback for the <Suspense> boundary wrapping MarketplaceBrowser
 * (which uses useSearchParams via FilterBar). Mirrors the real layout's
 * dimensions so there's no layout shift once the client component mounts.
 */
export function MarketplaceSkeleton() {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-40 border-b border-surface-container bg-surface-container-lowest px-8 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-36" />
          ))}
        </div>
      </div>
      <div className="flex min-h-[70vh] flex-1 flex-col lg:h-[75vh] lg:flex-row">
        <div className="flex-1 px-8 py-6 lg:w-[68%] lg:flex-none">
          <Skeleton className="mb-8 h-9 w-64" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full" />
            ))}
          </div>
        </div>
        <div className="hidden bg-surface-container-high lg:block lg:w-[32%]" />
      </div>
    </div>
  );
}

export default MarketplaceSkeleton;
