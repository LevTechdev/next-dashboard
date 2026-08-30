import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function CustomersLoading() {
  return <DashboardSkeleton stats={4} table />;
}
