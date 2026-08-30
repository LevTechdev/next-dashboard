import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function ProductsLoading() {
  return <DashboardSkeleton stats={4} table />;
}
