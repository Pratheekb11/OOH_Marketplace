import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import ListingCard from "./ListingCard";
import type { ListingOut } from "./types";

export interface ListingGridProps {
  listings: ListingOut[];
  loading: boolean;
  error: string | null;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function ListingGrid({ listings, loading, error, onClearFilters, hasActiveFilters }: ListingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load listings"
        description={error}
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Retry
          </Button>
        }
      />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        icon="search_off"
        title="No spaces match your filters"
        description={
          hasActiveFilters
            ? "Try widening your search — clear a filter or two and we'll show you what's available."
            : "There's no active inventory right now. Check back soon."
        }
        action={
          hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

export default ListingGrid;
