"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  RefreshCwIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
  MapPinIcon,
  DollarSignIcon,
  PhoneIcon,
} from "lucide-animated";
import { Edit2, Trash2, Mail, ShoppingBag, Crown } from "lucide-react";

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
import { formatCurrency, formatDate, getStatusColor, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { can } from "@/lib/permissions";

import { DataExportButton } from "@/components/data-export-button";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";

export default function CustomersPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { user } = useAuth();
  const tcustomers = useTranslations("customers");
  const tcommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    segment: "REGULAR",
  });

  const {
    data: customers,
    loading,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useRealtimeData<any[]>("/api/customers", {
    interval: 30000,
  });

  const role = (user as any)?.role;

  const dateFiltered = useMemo(() => {
    if (!customers) return [];
    if (!dateRange.from && !dateRange.to) return customers;
    return customers.filter((c: any) => {
      const d = new Date(c.createdAt);
      if (dateRange.from && d < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [customers, dateRange]);

  const filtered = dateFiltered.filter(
    (c: any) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  // Client-side pagination over the filtered list (export still covers all matches).
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const handleSave = async () => {
    const res = await fetch("/api/customers", {
      method: editCustomer ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editCustomer ? { ...form, id: editCustomer.id } : form),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(editCustomer ? tcustomers("updated") : tcustomers("added"));
    setDialogOpen(false);
    setEditCustomer(null);
    setForm({ name: "", email: "", phone: "", city: "", segment: "REGULAR" });
    refresh();
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: tcommon("delete"),
      description: tcustomers("confirmDelete"),
      confirmLabel: tcommon("delete"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(tcustomers("deleted"));
    refresh();
  };

  const openEdit = (customer: any) => {
    setEditCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      city: customer.city || "",
      segment: customer.segment || "REGULAR",
    });
    setDialogOpen(true);
  };

  // Compute derived stats
  const totalCustomers = customers?.length || 0;
  const vipCount = (customers || []).filter((c: any) => c.segment === "VIP").length;
  const totalSpent = (customers || []).reduce(
    (sum: number, c: any) => sum + (c.totalSpent || 0),
    0,
  );
  const avgOrdersPerCustomer =
    totalCustomers > 0
      ? (customers || []).reduce(
          (sum: number, c: any) => sum + (c._count?.orders || c.totalOrders || 0),
          0,
        ) / totalCustomers
      : 0;

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
          <h1 className="text-2xl font-bold">{tcustomers("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tcustomers("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {can(role, "create", "customers") && (
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditCustomer(null);
                    setForm({
                      name: "",
                      email: "",
                      phone: "",
                      city: "",
                      segment: "REGULAR",
                    });
                  }}
                >
                  <PlusIcon size={16} className="h-4 w-4 mr-2" /> {tcustomers("addCustomer")}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editCustomer ? tcustomers("editCustomer") : tcustomers("addCustomer")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder={tcustomers("namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  placeholder={tcustomers("emailPlaceholder")}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  placeholder={tcustomers("phonePlaceholder")}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  placeholder={tcustomers("cityPlaceholder")}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Select
                  value={form.segment}
                  onValueChange={(v) => setForm({ ...form, segment: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                    {tcommon("cancel")}
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editCustomer ? tcommon("save") : tcustomers("addCustomer")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: tcustomers("title") || "Total Customers",
            end: totalCustomers,
            icon: UsersIcon,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-900/20",
          },
          {
            label: tcustomers("vip") || "VIP Customers",
            end: vipCount,
            icon: Crown,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-900/20",
          },
          {
            label: tcustomers("totalSpent") || "Total Revenue",
            end: totalSpent,
            icon: DollarSignIcon,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            format: (v: number) => formatCurrency(v),
          },
          {
            label: tcustomers("orders") || "Avg Orders/Customer",
            end: avgOrdersPerCustomer,
            icon: ShoppingBag,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            decimals: 1,
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
                    {...(stat.format
                      ? { formatter: stat.format }
                      : { decimals: stat.decimals || 0 })}
                  />
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              />
              <Input
                placeholder={tcustomers("search") || tcommon("search")}
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
            {can(role, "create", "customers") && (
              <CsvImportDialog
                endpoint="/api/customers/import"
                columns={["name", "email", "phone", "city", "country", "segment", "notes"]}
                requiredColumns={["name"]}
                sampleRow="Jane Doe,jane@example.com,+1 555 0100,Jakarta,Indonesia,VIP,Repeat buyer"
                onImported={refresh}
              />
            )}
            <DataExportButton
              columns={[
                { key: "name", header: tcustomers("name") },
                { key: "email", header: tcustomers("email") },
                { key: "phone", header: tcustomers("phone") },
                { key: "city", header: tcustomers("city") },
                { key: "segment", header: tcustomers("segment") },
                { key: (c: any) => c.totalSpent || 0, header: tcustomers("totalSpent") },
                {
                  key: (c: any) => c._count?.orders || c.totalOrders || 0,
                  header: tcustomers("orders"),
                },
                {
                  key: (c: any) =>
                    c.lastOrderDate
                      ? new Date(c.lastOrderDate).toLocaleDateString()
                      : tcommon("na"),
                  header: tcustomers("lastOrder"),
                },
                {
                  key: (c: any) => new Date(c.createdAt).toLocaleDateString(),
                  header: tcustomers("created"),
                },
              ]}
              data={filtered}
              filename={`customers-export-${new Date().toISOString().split("T")[0]}`}
              label={tcommon("export")}
              showColumnSelector
              successMessage={tcustomers("exported")}
              totalCount={customers?.length || 0}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tcustomers("name")}</TableHead>
                  <TableHead>{tcommon("filter")}</TableHead>
                  <TableHead>{tcustomers("city")}</TableHead>
                  <TableHead>{tcustomers("segment")}</TableHead>
                  <TableHead>{tcustomers("totalSpent")}</TableHead>
                  <TableHead>{tcustomers("orders")}</TableHead>
                  <TableHead>{tcustomers("lastOrder")}</TableHead>
                  <TableHead className="text-right">{tcommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/${locale}/customers/${c.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <PhoneIcon size={12} className="h-3 w-3" /> {c.phone || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <MapPinIcon size={12} className="h-3 w-3" /> {c.city || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(c.segment || "REGULAR")}>
                        {c.segment || "REGULAR"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(c.totalSpent)}</TableCell>
                    <TableCell>{c._count?.orders || c.totalOrders || 0}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can(role, "update", "customers") && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {can(role, "delete", "customers") && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <UsersIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {tcustomers("noCustomers")}
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
    </motion.div>
  );
}
