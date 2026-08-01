import Skeleton from "@/components/ui/Skeleton";

/**
 * Fixed-size placeholder for the auth forms' <Suspense> boundary (the forms
 * read `?next=` via useSearchParams — see LoginForm.tsx / RegisterForm.tsx).
 * Shared by /login and /register so the split-screen layout never jumps
 * while the client component mounts. `fields` controls how many input rows
 * the skeleton reserves (2 for login: email + password; 4 for register:
 * name + email + password + confirm).
 */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-10" aria-hidden="true">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="space-y-2 pt-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-5 pt-6">
        {Array.from({ length: fields }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}

export default AuthFormSkeleton;
