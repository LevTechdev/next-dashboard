import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function DashboardLoading() {
  return <DashboardSkeleton stats={4} chart table />;
}
