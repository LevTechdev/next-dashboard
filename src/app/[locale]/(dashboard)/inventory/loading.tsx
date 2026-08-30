import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function InventoryLoading() {
  return <DashboardSkeleton stats={4} table />;
}
