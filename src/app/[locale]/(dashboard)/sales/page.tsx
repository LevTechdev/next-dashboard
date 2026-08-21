"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { RefreshCwIcon, TrendingUpIcon, DollarSignIcon } from "lucide-animated";
import { ShoppingCart, Store, Filter, ShoppingBag, Percent } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateTime, getStatusColor, salesChannels, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { DataExportButton } from "@/components/data-export-button";

// Maps salesChannels util slugs to sales namespace keys (brand names keep their English form)
const CHANNEL_KEYS: Record<string, string> = {
  "online-store": "onlineStore",
  facebook: "facebook",
  "facebook-shop": "facebookShop",
  instagram: "instagram",
  tiktok: "tiktok",
  shopify: "shopify",
};

export default function SalesPage() {
  const tsales = useTranslations("sales");
  const tcommon = useTranslations("common");
  const tstatus = useTranslations("status");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: orders,
    loading,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useRealtimeData<any[]>(`/api/orders?channel=${channelFilter}&status=${statusFilter}`, {
    interval: 15000,
  });

  const totalRevenue = useMemo(
    () => (orders || []).reduce((sum: number, o: any) => sum + o.grandTotal, 0),
    [orders],
  );
  const avgOrderValue = useMemo(
    () => (orders && orders.length > 0 ? totalRevenue / orders.length : 0),
    [totalRevenue, orders],
  );

  // Client-side pagination over the fetched orders (export still covers all rows).
  const totalPages = Math.max(1, Math.ceil((orders?.length || 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = (orders || []).slice(pageStart, pageStart + pageSize);

  const stats = useMemo(
    () => [
      {
        label: tsales("totalSales"),
        value: totalRevenue,
        formatter: (v: number) => formatCurrency(v),
        icon: DollarSignIcon,
        color: "text-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      {
        label: tsales("totalOrders"),
        value: orders?.length || 0,
        icon: ShoppingBag,
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-900/20",
      },
      {
        label: tsales("avgOrderValue"),
        value: avgOrderValue,
        formatter: (v: number) => formatCurrency(v),
        icon: TrendingUpIcon,
        color: "text-purple-600",
        bg: "bg-purple-50 dark:bg-purple-900/20",
      },
      {
        label: tsales("conversionRate"),
        value: 3.2,
        suffix: "%",
        decimals: 1,
        icon: Percent,
        color: "text-orange-600",
        bg: "bg-orange-50 dark:bg-orange-900/20",
      },
    ],
    [totalRevenue, orders, avgOrderValue, tsales],
  );

  if (loading)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shimmer rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-20 shimmer rounded" />
                    <div className="h-6 w-28 shimmer rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-12 shimmer rounded-lg" />
        <div className="h-80 shimmer rounded-lg" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tsales("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tsales("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
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
              { key: (o: any) => `#${o.orderNumber}`, header: tsales("orderNumber") },
              { key: (o: any) => o.customer?.name || tsales("guest"), header: tsales("customer") },
              {
                key: (o: any) => o.channel?.name || tcommon("na"),
                header: tsales("channel"),
              },
              { key: "status", header: tsales("status") },
              { key: "paymentStatus", header: tsales("payment") },
              { key: (o: any) => o.grandTotal, header: tsales("amount") },
              {
                key: (o: any) => new Date(o.createdAt).toLocaleDateString(),
                header: tsales("date"),
              },
            ]}
            data={orders || []}
            filename={`sales-export-${new Date().toISOString().split("T")[0]}`}
            label={tcommon("export")}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", stat.bg)}>
                  <stat.icon size={20} className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold">
                    <AnimatedCounter
                      end={stat.value}
                      duration={1400}
                      formatter={stat.formatter}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-gray-400" />
              <Select
                value={channelFilter}
                onValueChange={(v) => {
                  setChannelFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={tsales("allChannels")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tsales("allChannels")}</SelectItem>
                  {salesChannels.map((ch) => (
                    <SelectItem key={ch.slug} value={ch.slug}>
                      {tsales(CHANNEL_KEYS[ch.slug] ?? ch.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={tcommon("all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tcommon("all")}</SelectItem>
                  <SelectItem value="PENDING">{tstatus("pending")}</SelectItem>
                  <SelectItem value="PROCESSING">{tstatus("processing")}</SelectItem>
                  <SelectItem value="SHIPPED">{tstatus("shipped")}</SelectItem>
                  <SelectItem value="DELIVERED">{tstatus("delivered")}</SelectItem>
                  <SelectItem value="CANCELLED">{tstatus("cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tsales("orderList")}</TableHead>
                  <TableHead>{tsales("customer")}</TableHead>
                  <TableHead>{tsales("channel")}</TableHead>
                  <TableHead>{tsales("status")}</TableHead>
                  <TableHead>{tcommon("status")}</TableHead>
                  <TableHead>{tsales("amount")}</TableHead>
                  <TableHead>{tsales("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      #{order.orderNumber}
                    </TableCell>
                    <TableCell>{order.customer?.name || tsales("guest")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.channel?.name || tcommon("na")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.paymentStatus)}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(order.grandTotal)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!orders || orders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />{" "}
                      {tsales("noOrders")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {orders && orders.length > 0 && (
            <PaginationBar
              total={orders.length}
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
    </div>
  );
}
