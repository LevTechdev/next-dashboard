"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RefreshCwIcon, PlusIcon, SearchIcon, DollarSignIcon, LayersIcon } from "lucide-animated";
import { Edit2, Trash2, Package, BarChart3, AlertTriangle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, cn, shortenName, sanitizeInteger } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { can } from "@/lib/permissions";
import { DataExportButton } from "@/components/data-export-button";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { LinkedPlatformsBadge } from "@/components/linked-platforms-badge";
import { useConfirm } from "@/components/ui/confirm-provider";

export default function ProductsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { user } = useAuth();
  const tproducts = useTranslations("products");
  const tcommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [editProduct, setEditProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    costPrice: "",
    stock: "",
    sku: "",
    categoryId: "",
  });

  const {
    data: productsData,
    loading,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useRealtimeData<{ products: any[]; categories: any[] }>(
    "/api/products?includeCategories=true",
    { interval: 30000 },
  );

  const products = productsData?.products || [];
  const categories = productsData?.categories || [];

  const role = (user as any)?.role;

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const dateFiltered = useMemo(() => {
    if (!products.length) return [];
    if (!dateRange.from && !dateRange.to) return products;
    return products.filter((p: any) => {
      const d = new Date(p.createdAt);
      if (dateRange.from && d < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [products, dateRange]);

  const filtered = dateFiltered.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

  // Client-side pagination over the filtered list (export still covers all matches).
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p: any) => p.id)),
    );
  };

  const confirm = useConfirm();

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: tcommon("delete"),
      description: tproducts("bulkDeleteConfirm", { count: selected.size }),
      confirmLabel: tcommon("delete"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
    });
    if (res.ok) {
      toast.success(tproducts("bulkDeleted", { count: selected.size }));
      setSelected(new Set());
      refresh();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const handleSave = async () => {
    const body = editProduct ? { ...form, id: editProduct.id } : form;
    const method = editProduct ? "PUT" : "POST";
    const res = await fetch("/api/products", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(editProduct ? tproducts("updated") : tproducts("added"));
    setDialogOpen(false);
    setEditProduct(null);
    setForm({
      name: "",
      description: "",
      price: "",
      costPrice: "",
      stock: "",
      sku: "",
      categoryId: "",
    });
    refresh();
  };

  const [deleteProduct, setDeleteProduct] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteProduct = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    const res = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteProduct.id }),
    });
    setDeleting(false);
    if (res.ok) {
      toast.success(tproducts("deleted"));
      setDeleteProduct(null);
      refresh();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const openEdit = (product: any) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      costPrice: product.costPrice.toString(),
      stock: product.stock.toString(),
      sku: product.sku || "",
      categoryId: product.categoryId || "",
    });
    setDialogOpen(true);
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge variant="danger">{tproducts("outOfStock")}</Badge>;
    if (stock < 10)
      return (
        <Badge variant="warning">
          {tproducts("lowStock")} ({stock})
        </Badge>
      );
    return (
      <Badge variant="success">
        {tproducts("inStock")} ({stock})
      </Badge>
    );
  };

  // Compute derived stats
  const totalProducts = products.length;
  const categoryCount = categories.length;
  const avgPrice =
    totalProducts > 0
      ? products.reduce((sum: number, p: any) => sum + p.price, 0) / totalProducts
      : 0;
  const totalStockValue = products.reduce(
    (sum: number, p: any) => sum + p.price * (p.stock || 0),
    0,
  );

  // Skeleton loading
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tproducts("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tproducts("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {can(role, "create", "products") && (
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditProduct(null);
                    setForm({
                      name: "",
                      description: "",
                      price: "",
                      costPrice: "",
                      stock: "",
                      sku: "",
                      categoryId: "",
                    });
                  }}
                >
                  <PlusIcon size={16} className="h-4 w-4 mr-2" /> {tproducts("addProduct")}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editProduct ? tproducts("editProduct") : tproducts("addProduct")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder={tproducts("name")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  placeholder={tcommon("description")}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={tproducts("price")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: sanitizeInteger(e.target.value) })}
                  />
                  <Input
                    placeholder={tproducts("costPrice")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: sanitizeInteger(e.target.value) })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={tproducts("stock")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: sanitizeInteger(e.target.value) })}
                  />
                  <Input
                    placeholder={tproducts("sku")}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tproducts("category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSave} className="w-full">
                  {editProduct ? tproducts("editProduct") : tproducts("addProduct")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: tproducts("title") || "Total Products",
            end: totalProducts,
            icon: Package,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-900/20",
          },
          {
            label: tproducts("category") || "Categories",
            end: categoryCount,
            icon: LayersIcon,
            color: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-50 dark:bg-indigo-900/20",
          },
          {
            label: tproducts("price") || "Avg Price",
            end: avgPrice,
            icon: DollarSignIcon,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            format: (v: number) => formatCurrency(v),
          },
          {
            label: tproducts("stock") || "Stock Value",
            end: totalStockValue,
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
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
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
            </Button>
            {can(role, "create", "products") && (
              <CsvImportDialog
                endpoint="/api/products/import"
                columns={["name", "price", "costPrice", "stock", "sku", "category", "description"]}
                requiredColumns={["name", "price"]}
                sampleRow="Wireless Mouse,29.99,12.5,100,WM-001,Electronics,Ergonomic wireless mouse"
                onImported={refresh}
              />
            )}
            <DataExportButton
              columns={[
                { key: "name", header: "Name" },
                { key: (p: any) => p.category?.name || "-", header: "Category" },
                { key: (p: any) => p.price, header: "Price" },
                { key: (p: any) => p.costPrice, header: "Cost Price" },
                {
                  key: (p: any) => {
                    const margin =
                      p.price > 0 ? (((p.price - p.costPrice) / p.price) * 100).toFixed(0) : "0";
                    return `${margin}%`;
                  },
                  header: "Margin",
                },
                { key: (p: any) => p.stock, header: "Stock" },
                { key: "sku", header: "SKU" },
                { key: (p: any) => p.description || "", header: "Description" },
              ]}
              data={filtered}
              filename={`products-export-${new Date().toISOString().split("T")[0]}`}
              label="Export"
              showColumnSelector
              totalCount={products.length}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 mb-4 mx-4 sm:mx-0 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {tproducts("selectedCount", { count: selected.size })}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  {tcommon("cancel")}
                </Button>
                {can(role, "delete", "products") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-700 border-red-200 dark:border-red-800"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {tcommon("delete")}
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-indigo-500 cursor-pointer"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>{tproducts("name")}</TableHead>
                  <TableHead>{tproducts("category")}</TableHead>
                  <TableHead>{tproducts("price")}</TableHead>
                  <TableHead>{tproducts("costPrice")}</TableHead>
                  <TableHead>{tcommon("filter")}</TableHead>
                  <TableHead>{tproducts("stock")}</TableHead>
                  <TableHead>{tproducts("sku")}</TableHead>
                  <TableHead className="text-right">{tcommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p: any) => {
                  const margin =
                    p.price > 0 ? (((p.price - p.costPrice) / p.price) * 100).toFixed(0) : "0";
                  return (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-500 cursor-pointer"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/${locale}/products/${p.id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                          title={p.name}
                        >
                          {shortenName(p.name, 48)}
                        </Link>
                        {p._count?.affiliateLinks > 0 && (
                          <LinkedPlatformsBadge
                            productId={p.id}
                            count={p._count.affiliateLinks}
                            className="ml-2"
                          />
                        )}
                      </TableCell>
                      <TableCell>{p.category?.name || "-"}</TableCell>
                      <TableCell>{formatCurrency(p.price)}</TableCell>
                      <TableCell className="text-gray-500">{formatCurrency(p.costPrice)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            parseInt(margin) > 50
                              ? "success"
                              : parseInt(margin) > 20
                                ? "default"
                                : "warning"
                          }
                        >
                          {margin}%
                        </Badge>
                      </TableCell>
                      <TableCell>{getStockBadge(p.stock)}</TableCell>
                      <TableCell className="text-xs text-gray-500">{p.sku || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {can(role, "update", "products") && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {can(role, "delete", "products") && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteProduct(p)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {tproducts("noProducts")}
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

      {/* Delete product confirmation */}
      <Dialog open={!!deleteProduct} onOpenChange={(o) => !o && setDeleteProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {tproducts("deleteProduct")}
            </DialogTitle>
          </DialogHeader>
          {deleteProduct && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                {deleteProduct.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={deleteProduct.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={deleteProduct.name}>
                    {shortenName(deleteProduct.name, 40)}
                  </p>
                  <p className="text-xs text-gray-500">{formatCurrency(deleteProduct.price)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tproducts("deleteProductWarning")}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteProduct(null)}>
                  {tcommon("cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDeleteProduct} disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleting ? tcommon("loading") : tcommon("delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
