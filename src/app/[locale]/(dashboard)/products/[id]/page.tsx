"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  CheckIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  HistoryIcon,
} from "lucide-animated";
import { Package } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime, getStatusColor, cn, sanitizeInteger } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { ProductImageManager } from "@/components/product-image-manager";
import { ProductAffiliateLinks } from "@/components/product-affiliate-links";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const locale = (params?.locale as string) || "en";
  const id = params?.id as string;
  const tproducts = useTranslations("products");
  const torders = useTranslations("orders");
  const tcommon = useTranslations("common");

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    costPrice: "",
    stock: "",
    sku: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${id}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setProduct(data);
      setForm({
        name: data.name || "",
        description: data.description || "",
        price: String(data.price ?? ""),
        costPrice: String(data.costPrice ?? ""),
        stock: String(data.stock ?? ""),
        sku: data.sku || "",
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // When arriving via a #platform-links deep link, scroll to that section once
  // the (async-loaded) product content is in the DOM.
  useEffect(() => {
    if (!product) return;
    if (typeof window !== "undefined" && window.location.hash === "#platform-links") {
      requestAnimationFrame(() => {
        document
          .getElementById("platform-links")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [product]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(tproducts("updated"));
      setReloadKey((k) => k + 1);
    } else {
      toast.error(tcommon("error"));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 shimmer rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="h-64 shimmer rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="h-64 shimmer rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">{tproducts("notFound")}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/products`)}>
          <ArrowLeftIcon size={16} className="h-4 w-4 mr-2" />
          {tproducts("backToProducts")}
        </Button>
      </div>
    );
  }

  const price = parseFloat(form.price) || 0;
  const cost = parseFloat(form.costPrice) || 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
  const stock = product.stock ?? 0;
  const stockStatus =
    stock === 0
      ? tproducts("outOfStock")
      : stock < 10
        ? tproducts("lowStock")
        : tproducts("inStock");
  const stockColor =
    stock === 0
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : stock < 10
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";

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
          <Link href={`/${locale}/products`}>
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon size={16} className="h-4 w-4 mr-1" />
              {tproducts("backToProducts")}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {product.name}
              <Badge className={stockColor}>{stockStatus}</Badge>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {product.category?.name || tcommon("na")} · SKU: {product.sku || tcommon("na")}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <CheckIcon size={16} className="h-4 w-4 mr-1" />
          {saving ? tcommon("loading") : tcommon("save")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: edit form + recent orders */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tproducts("editProduct")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{tproducts("name")}</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{tproducts("price")}</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: sanitizeInteger(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {tproducts("costPrice")}
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: sanitizeInteger(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{tproducts("stock")}</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: sanitizeInteger(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{tproducts("sku")}</label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">
                    {tcommon("description")}
                  </label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent orders containing this product */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tproducts("recentOrders")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{torders("orderNumber")}</TableHead>
                      <TableHead>{torders("status")}</TableHead>
                      <TableHead>{torders("date")}</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">{torders("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(product.orderItems || []).map((item: any) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/${locale}/orders/${item.orderId}`)}
                      >
                        <TableCell className="font-medium text-indigo-600 dark:text-indigo-400">
                          #{item.order?.orderNumber}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.order?.status)}>
                            {item.order?.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {item.order?.createdAt ? formatDateTime(item.order.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(product.orderItems || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          {torders("noOrders")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <ProductAffiliateLinks
            productId={product.id}
            canManage={can(role, "update", "affiliates")}
            canDelete={can(role, "delete", "affiliates")}
          />
        </div>

        {/* Right: pricing stats + inventory history */}
        <div className="space-y-6">
          <ProductImageManager
            productId={product.id}
            name={product.name}
            initialImage={product.image || null}
            initialImages={product.images || []}
            canEdit={can(role, "update", "products")}
          />
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tproducts("price")}</span>
                <span className="font-semibold">{formatCurrency(price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tproducts("costPrice")}</span>
                <span className="font-semibold">{formatCurrency(cost)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-gray-500">{tproducts("margin")}</span>
                <span
                  className={cn(
                    "font-semibold",
                    margin >= 30
                      ? "text-emerald-600 dark:text-emerald-400"
                      : margin >= 10
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {margin.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon size={16} className="h-4 w-4" />
                {tproducts("inventoryHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
                {(product.inventoryItems || []).map((rec: any) => (
                  <div key={rec.id} className="flex items-start gap-3 text-sm">
                    <div
                      className={cn(
                        "mt-0.5 p-1.5 rounded-lg",
                        rec.type === "IN"
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : rec.type === "OUT"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-gray-100 dark:bg-gray-800",
                      )}
                    >
                      {rec.type === "IN" ? (
                        <TrendingUpIcon
                          size={14}
                          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                      ) : (
                        <TrendingDownIcon
                          size={14}
                          className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {rec.type} {rec.type === "OUT" ? "-" : "+"}
                        {Math.abs(rec.quantity)}
                      </p>
                      {rec.notes && <p className="text-xs text-gray-500 truncate">{rec.notes}</p>}
                      <p className="text-xs text-gray-400">{formatDateTime(rec.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {(product.inventoryItems || []).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">{tcommon("noData")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
