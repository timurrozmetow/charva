import { cn } from '../cn';

export interface SkeletonProps {
  className?: string;
  /** Repeat the shape — a list of three loading cards. */
  count?: number;
}

/**
 * A loading placeholder.
 *
 * The handoff has no loading state anywhere, because its data is nine arrays declared at the
 * top of each file. Every one of those becomes a request over a connection that this audience
 * often reaches from a phone on mobile data.
 *
 * It is a decoration, not a status: `aria-hidden`, with the surrounding region carrying
 * `aria-busy`. A screen reader announcing "loading, loading, loading" once per placeholder
 * card is worse than silence.
 */
export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn('animate-pulse rounded-card bg-line-soft', className)}
        />
      ))}
    </>
  );
}
