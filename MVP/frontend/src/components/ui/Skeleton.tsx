export interface SkeletonProps {
  className?: string;
}

/** Generic shimmer placeholder — sizing is entirely up to the caller's className. */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`shimmer rounded-md bg-surface-container-highest ${className}`} aria-hidden="true" />;
}

export default Skeleton;
