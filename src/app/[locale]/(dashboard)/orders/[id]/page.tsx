"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ClockIcon,
  UserIcon,
  MapPinIcon,
  CreditCardIcon,
  ArrowLeftIcon,
  TruckIcon,
} from "lucide-animated";
import { ShoppingBag, Store, RotateCcw, PackageSearch, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, getStatusColor } from "@/lib/utils";
import { isTerminalOrderStatus } from "@/lib/order-status";
import {
  OrderTrackingTimeline,
  getTrackingEventsFromOrder,
} from "@/components/order-tracking-timeline";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

interface FulfillmentStamp {
  label: string;
  at: string | null;
}

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

  // Fulfillment form state (tracking number + carrier)
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);

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

  // Sync the fulfillment form whenever the order loads/refreshes
  useEffect(() => {
    if (order) {
      setTrackingNumber(order.trackingNumber ?? "");
      setCarrier(order.carrier ?? "");
    }
  }, [order?.id, order?.trackingNumber, order?.carrier]);

  const confirm = useConfirm();

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
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || tcommon("error"));
    }
  };

  const handleCancelOrder = async () => {
    const ok = await confirm({
      description: torders("confirmCancelOrder"),
      confirmLabel: tcommon("confirm"),
      destructive: true,
    });
    if (!ok) return;
    await updateStatus("CANCELLED");
  };

  const handleRefundOrder = async () => {
    const ok = await confirm({
      description: torders("refundConfirm"),
      confirmLabel: tcommon("confirm"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REFUNDED" }),
    });
    if (res.ok) {
      toast.success(torders("refundedToast"));
      refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || tcommon("error"));
    }
  };

  const saveTracking = async () => {
    setSavingTracking(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim(),
          carrier: carrier.trim(),
        }),
      });
      if (res.ok) {
        toast.success(torders("trackingSaved"));
        refresh();
      } else {
        toast.error(torders("trackingSaveFailed"));
      }
    } catch {
      toast.error(torders("trackingSaveFailed"));
    } finally {
      setSavingTracking(false);
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

  // Next actionable step per the state machine (PENDING → PROCESSING → SHIPPED → DELIVERED)
  const nextAction: { status: string; label: string } | null =
    order.status === "PENDING"
      ? { status: "PROCESSING", label: torders("processBtn") }
      : order.status === "PROCESSING"
        ? { status: "SHIPPED", label: torders("shipBtn") }
        : order.status === "SHIPPED"
          ? { status: "DELIVERED", label: torders("deliverBtn") }
          : null;

  const terminal = isTerminalOrderStatus(order.status);
  const canEditFulfillment = ["PENDING", "PROCESSING", "SHIPPED"].includes(order.status);

  const fulfillmentStamps: FulfillmentStamp[] = [
    { label: torders("processedOn"), at: order.processingAt },
    { label: torders("shippedOn"), at: order.shippedAt },
    { label: torders("deliveredOn"), at: order.deliveredAt },
    { label: torders("refundedOn"), at: order.refundedAt },
  ].filter((s) => Boolean(s.at));

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
        <div className="flex items-center gap-2 flex-wrap">
          {nextAction && (
            <Button size="sm" onClick={() => updateStatus(nextAction.status)}>
              {nextAction.label}
            </Button>
          )}
          {!terminal && (
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
              onClick={handleRefundOrder}
            >
              <RotateCcw size={14} className="h-4 w-4 mr-1" />
              {torders("refundBtn")}
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

        {/* Right: fulfillment + tracking */}
        <div className="space-y-6">
          {/* Fulfillment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PackageSearch className="h-4 w-4" />
                {torders("fulfillmentTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canEditFulfillment ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      {torders("trackingNumber")}
                    </label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={torders("trackingNumberPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      {torders("carrier")}
                    </label>
                    <Input
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder={torders("carrierPlaceholder")}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={saveTracking}
                    disabled={savingTracking}
                    className="w-full"
                  >
                    {savingTracking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TruckIcon size={16} className="h-4 w-4 mr-2" />
                    )}
                    {torders("trackingSave")}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{torders("trackingNumber")}</span>
                    <span className="text-sm font-medium">
                      {order.trackingNumber || torders("na")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{torders("carrier")}</span>
                    <span className="text-sm font-medium capitalize">
                      {order.carrier || torders("na")}
                    </span>
                  </div>
                </div>
              )}

              {fulfillmentStamps.length > 0 && (
                <div className="border-t pt-3 space-y-1.5">
                  {fulfillmentStamps.map((stamp) => (
                    <div key={stamp.label} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{stamp.label}</span>
                      <span className="font-medium">{formatDateTime(stamp.at!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tracking timeline */}
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
      </div>
    </motion.div>
  );
}
