"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  RefreshCwIcon,
  ClockIcon,
  SearchIcon,
  EyeIcon,
  MapPinIcon,
  CreditCardIcon,
  UserIcon,
  DollarSignIcon,
} from "lucide-animated";
import { ShoppingBag, Store, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateTime, getStatusColor, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import {
  OrderTrackingTimeline,
  getTrackingEventsFromOrder,
} from "@/components/order-tracking-timeline";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DataExportButton } from "@/components/data-export-button";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";

export default function OrdersPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const torders = useTranslations("orders");
  const tcommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  const {
    data: orders,
    loading,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useRealtimeData<any[]>("/api/orders", {
    interval: 15000,
    realtime: { table: "Order", event: "*" },
  });

  const dateFiltered = useMemo(() => {
    if (!orders) return [];
    if (!dateRange.from && !dateRange.to) return orders;
    return orders.filter((o: any) => {
      const d = new Date(o.createdAt);
      if (dateRange.from && d < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [orders, dateRange]);

  // Compute stats from date-filtered orders data
  const totalRevenue = dateFiltered.reduce((sum: number, o: any) => sum + (o.grandTotal || 0), 0);
  const pendingCount = dateFiltered.filter((o: any) => o.status === "PENDING").length;
  const avgOrderValue = dateFiltered.length > 0 ? totalRevenue / dateFiltered.length : 0;

  const filtered = dateFiltered.filter(
    (o: any) =>
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  // Client-side pagination over the filtered list (export still covers all matches).
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(torders("markedAs", { status }));
    refresh();
  };

  const confirm = useConfirm();

  const handleCancelOrder = async (id: string) => {
    const ok = await confirm({
      description: torders("confirmCancelOrder"),
      confirmLabel: tcommon("confirm"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "CANCELLED" }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(torders("orderCancelled"));
    refresh();
  };

  // Skeleton loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-12 w-12 shimmer rounded-lg mb-4" />
                <div className="h-4 w-24 shimmer rounded mb-2" />
                <div className="h-8 w-32 shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-64 shimmer rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{torders("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{torders("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCwIcon
              size={14}
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">{tcommon("view")}</span>
          </Button>
          <DataExportButton
            columns={[
              { key: "orderNumber", header: "Order #" },
              {
                key: (o: any) => o.customer?.name || torders("guest"),
                header: torders("customer"),
              },
              { key: (o: any) => o.channel?.name || torders("na"), header: torders("channel") },
              { key: (o: any) => o.items?.length || 0, header: torders("items") },
              { key: (o: any) => o.totalAmount, header: torders("subtotal") },
              { key: (o: any) => o.grandTotal, header: torders("grandTotal") },
              { key: "status", header: torders("status") },
              { key: "paymentStatus", header: torders("paymentStatus") },
              { key: "paymentMethod", header: torders("paymentMethod") },
              { key: (o: any) => o.customer?.email || "", header: "Email" },
              { key: (o: any) => o.shippingAddress || "", header: torders("shippingAddressCsv") },
              {
                key: (o: any) => new Date(o.createdAt).toLocaleDateString(),
                header: torders("date"),
              },
            ]}
            data={filtered}
            filename={`orders-export-${new Date().toISOString().split("T")[0]}`}
            label={tcommon("export")}
            showColumnSelector
            successMessage={torders("ordersExported")}
            totalCount={orders?.length || 0}
          />
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: torders("totalOrders") || "Total Orders",
            end: orders?.length || 0,
            icon: ShoppingBag,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-900/20",
          },
          {
            label: torders("totalRevenue") || "Total Revenue",
            end: totalRevenue,
            icon: DollarSignIcon,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            format: (v: number) => formatCurrency(v),
          },
          {
            label: torders("pending") || "Pending",
            end: pendingCount,
            icon: ClockIcon,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-900/20",
          },
          {
            label: torders("avgOrder") || "Avg Order",
            end: avgOrderValue,
            icon: BarChart3,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            format: (v: number) => formatCurrency(v),
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="group hover:shadow-md transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "p-2.5 rounded-lg transition-transform group-hover:scale-110 duration-300",
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  <AnimatedCounter
                    end={stat.end}
                    duration={1400}
                    {...(stat.format ? { formatter: stat.format } : {})}
                  />
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            />
            <Input
              placeholder={tcommon("search")}
              className="pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{torders("orderNumber")}</TableHead>
                  <TableHead>{torders("customer")}</TableHead>
                  <TableHead>{torders("channel")}</TableHead>
                  <TableHead>{torders("items")}</TableHead>
                  <TableHead>{torders("total")}</TableHead>
                  <TableHead>{torders("status")}</TableHead>
                  <TableHead>{torders("payment")}</TableHead>
                  <TableHead>{torders("date")}</TableHead>
                  <TableHead className="text-right">{tcommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      <Link
                        href={`/${locale}/orders/${order.id}`}
                        className="text-lime-600 dark:text-indigo-400 hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customer?.name || torders("guest")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.channel?.name || torders("na")}</Badge>
                    </TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(order.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.paymentStatus)}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedOrder(order);
                            setActiveTab("details");
                          }}
                          title={torders("viewDetails")}
                        >
                          <EyeIcon size={16} className="h-4 w-4" />
                        </Button>
                        {order.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => updateStatus(order.id, "PROCESSING")}
                          >
                            {torders("processBtn")}
                          </Button>
                        )}
                        {order.status === "PROCESSING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => updateStatus(order.id, "SHIPPED")}
                          >
                            {torders("shipBtn")}
                          </Button>
                        )}
                        {order.status === "SHIPPED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => updateStatus(order.id, "DELIVERED")}
                          >
                            {torders("deliverBtn")}
                          </Button>
                        )}
                        {(order.status === "PENDING" || order.status === "PROCESSING") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleCancelOrder(order.id)}
                          >
                            {torders("cancelBtn")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />{" "}
                      {torders("noOrders")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <PaginationBar
              total={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Enhanced Order Detail Dialog with Tracking */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Order #{selectedOrder?.orderNumber}
              <Badge className={getStatusColor(selectedOrder?.status)}>
                {selectedOrder?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="md:w-full md:justify-start">
                <TabsTrigger value="details">{torders("tabDetails")}</TabsTrigger>
                <TabsTrigger value="tracking">{torders("tabTracking")}</TabsTrigger>
                <TabsTrigger value="items">{torders("tabItems")}</TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <UserIcon size={14} className="h-3.5 w-3.5" />
                      {torders("orderCustomer")}
                    </div>
                    <p className="text-sm font-medium">
                      {selectedOrder.customer?.name || torders("guest")}
                    </p>
                    {selectedOrder.customer?.email && (
                      <p className="text-xs text-gray-500">{selectedOrder.customer.email}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Store className="h-3.5 w-3.5" />
                      {torders("orderChannel")}
                    </div>
                    <p className="text-sm font-medium">
                      {selectedOrder.channel?.name || torders("na")}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <CreditCardIcon size={14} className="h-3.5 w-3.5" />
                      {torders("orderPayment")}
                    </div>
                    <p className="text-sm font-medium capitalize">
                      {selectedOrder.paymentMethod?.replace(/_/g, " ").toLowerCase() ||
                        torders("na")}
                    </p>
                    <Badge className={getStatusColor(selectedOrder.paymentStatus)}>
                      {selectedOrder.paymentStatus}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {torders("orderDate")}
                    </div>
                    <p className="text-sm font-medium">{formatDateTime(selectedOrder.createdAt)}</p>
                  </div>
                </div>

                {selectedOrder.shippingAddress && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <MapPinIcon size={14} className="h-3.5 w-3.5" />
                      {torders("shippingAddress")}
                    </div>
                    <p className="text-sm font-medium">{selectedOrder.shippingAddress}</p>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                      {torders("notes")}
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-300">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Tracking Tab */}
              <TabsContent value="tracking">
                <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <OrderTrackingTimeline
                    currentStatus={selectedOrder.status}
                    events={getTrackingEventsFromOrder(selectedOrder)}
                  />
                </div>
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="space-y-4">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedOrder.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{torders("subtotal")}</span>
                    <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                  </div>
                  {selectedOrder.shippingAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{torders("shipping")}</span>
                      <span>{formatCurrency(selectedOrder.shippingAmount)}</span>
                    </div>
                  )}
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{torders("discount")}</span>
                      <span className="text-red-500">
                        -{formatCurrency(selectedOrder.discountAmount)}
                      </span>
                    </div>
                  )}
                  {selectedOrder.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{torders("tax")}</span>
                      <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-2">
                    <span>{torders("totalLabel")}</span>
                    <span>{formatCurrency(selectedOrder.grandTotal)}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
