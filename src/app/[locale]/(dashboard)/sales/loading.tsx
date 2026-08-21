import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function SalesLoading() {
  return <DashboardSkeleton stats={4} table />;
}
