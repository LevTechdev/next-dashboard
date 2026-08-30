import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function OrdersLoading() {
  return <DashboardSkeleton stats={4} table />;
}
