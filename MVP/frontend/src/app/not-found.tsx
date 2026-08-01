import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <EmptyState
        icon="signpost"
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Button href="/" variant="primary" size="md">
            Back to home
          </Button>
        }
      />
    </main>
  );
}
