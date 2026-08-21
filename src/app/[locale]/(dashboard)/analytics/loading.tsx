import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function AnalyticsLoading() {
  return <DashboardSkeleton stats={4} chart />;
}
