"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ClockIcon, UserIcon, MapPinIcon, CreditCardIcon, ArrowLeftIcon } from "lucide-animated";
import { ShoppingBag, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, getStatusColor } from "@/lib/utils";
import {
  OrderTrackingTimeline,
  getTrackingEventsFromOrder,
} from "@/components/order-tracking-timeline";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const id = params?.id as string;
  const torders = useTranslations("orders");
  const tcommon = useTranslations("common");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${id}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setOrder(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(torders("markedAs", { status }));
      refresh();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const confirm = useConfirm();

  const handleCancelOrder = async () => {
    const ok = await confirm({
      description: torders("confirmCancelOrder"),
      confirmLabel: tcommon("confirm"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      toast.success(torders("orderCancelled"));
      refresh();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 shimmer rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="h-48 shimmer rounded" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="h-64 shimmer rounded" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="h-96 shimmer rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">{torders("notFound")}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/orders`)}>
          <ArrowLeftIcon size={16} className="h-4 w-4 mr-2" />
          {torders("backToOrders")}
        </Button>
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/orders`}>
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon size={16} className="h-4 w-4 mr-1" />
              {torders("backToOrders")}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              #{order.orderNumber}
              <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
              <Badge className={getStatusColor(order.paymentStatus)}>{order.paymentStatus}</Badge>
            </h1>
            <p className="text-sm text-gray-500 mt-1">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.status === "PENDING" && (
            <Button size="sm" onClick={() => updateStatus("PROCESSING")}>
              {torders("processBtn")}
            </Button>
          )}
          {order.status === "PROCESSING" && (
            <Button size="sm" onClick={() => updateStatus("SHIPPED")}>
              {torders("shipBtn")}
            </Button>
          )}
          {order.status === "SHIPPED" && (
            <Button size="sm" onClick={() => updateStatus("DELIVERED")}>
              {torders("deliverBtn")}
            </Button>
          )}
          {(order.status === "PENDING" || order.status === "PROCESSING") && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-500 hover:text-red-700"
              onClick={handleCancelOrder}
            >
              {torders("cancelBtn")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: order info + items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <UserIcon size={14} className="h-3.5 w-3.5" />
                  {torders("orderCustomer")}
                </div>
                {order.customer ? (
                  <Link
                    href={`/${locale}/customers/${order.customer.id}`}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {order.customer.name}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{torders("guest")}</p>
                )}
                {order.customer?.email && (
                  <p className="text-xs text-gray-500">{order.customer.email}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Store className="h-3.5 w-3.5" />
                  {torders("orderChannel")}
                </div>
                <p className="text-sm font-medium">{order.channel?.name || torders("na")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <CreditCardIcon size={14} className="h-3.5 w-3.5" />
                  {torders("orderPayment")}
                </div>
                <p className="text-sm font-medium capitalize">
                  {order.paymentMethod?.replace(/_/g, " ").toLowerCase() || torders("na")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <ClockIcon size={14} className="h-3.5 w-3.5" />
                  {torders("orderDate")}
                </div>
                <p className="text-sm font-medium">{formatDateTime(order.createdAt)}</p>
              </CardContent>
            </Card>
          </div>

          {order.shippingAddress && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <MapPinIcon size={14} className="h-3.5 w-3.5" />
                  {torders("shippingAddress")}
                </div>
                <p className="text-sm font-medium">{order.shippingAddress}</p>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{torders("tabItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {order.items?.map((item: any) => (
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

              <div className="border-t mt-4 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{torders("subtotal")}</span>
                  <span>{formatCurrency(order.totalAmount)}</span>
                </div>
                {order.shippingAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{torders("shipping")}</span>
                    <span>{formatCurrency(order.shippingAmount)}</span>
                  </div>
                )}
                {order.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{torders("discount")}</span>
                    <span className="text-red-500">-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                {order.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{torders("tax")}</span>
                    <span>{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{torders("totalLabel")}</span>
                  <span>{formatCurrency(order.grandTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                {torders("notes")}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-300">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right: tracking timeline */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{torders("tabTracking")}</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTrackingTimeline
              currentStatus={order.status}
              events={getTrackingEventsFromOrder(order)}
            />
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
