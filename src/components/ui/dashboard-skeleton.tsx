import { Card, CardContent } from "./card";

interface DashboardSkeletonProps {
  /** Number of stat cards to show */
  stats?: number;
  /** Show a table skeleton below stats */
  table?: boolean;
  /** Show a chart skeleton below stats */
  chart?: boolean;
}

export function DashboardSkeleton({
  stats = 4,
  table = true,
  chart = false,
}: DashboardSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading...">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 shimmer rounded" />
          <div className="h-4 w-64 shimmer rounded" />
        </div>
        <div className="h-8 w-24 shimmer rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: stats }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-12 w-12 shimmer rounded-lg mb-4" />
              <div className="h-4 w-24 shimmer rounded mb-2" />
              <div className="h-8 w-32 shimmer rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      {chart && (
        <Card>
          <CardContent className="p-6">
            <div className="h-[300px] shimmer rounded" />
          </CardContent>
        </Card>
      )}

      {/* Table skeleton */}
      {table && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="h-4 w-48 shimmer rounded" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 flex-1 shimmer rounded" />
                  <div className="h-4 w-24 shimmer rounded" />
                  <div className="h-4 w-16 shimmer rounded" />
                  <div className="h-4 w-20 shimmer rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <span className="sr-only">Loading...</span>
    </div>
  );
}
