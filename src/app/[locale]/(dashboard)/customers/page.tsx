"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Download,
  DollarSign,
  ShoppingBag,
  Sparkles,
  Crown,
} from "lucide-react";
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
import { formatCurrency, formatDate, getStatusColor, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { can } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import { DataExportButton } from "@/components/data-export-button";

export default function CustomersPage() {
  const { user } = useAuth();
  const tcustomers = useTranslations("customers");
  const tcommon = useTranslations("common");
  const [search, setSearch] = useState("");
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

  const filtered = (customers || []).filter(
    (c: any) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (editCustomer) {
      await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editCustomer.id }),
      });
      toast.success(tcustomers("updated"));
    } else {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success(tcustomers("added"));
    }
    setDialogOpen(false);
    setEditCustomer(null);
    setForm({ name: "", email: "", phone: "", city: "", segment: "REGULAR" });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tcustomers("confirmDelete"))) return;
    await fetch("/api/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
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
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
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
                  <Plus className="h-4 w-4 mr-2" /> {tcustomers("addCustomer")}
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
            icon: Users,
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
            icon: DollarSign,
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
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <Sparkles className="h-3 w-3 text-gray-300 dark:text-gray-600" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={tcustomers("search") || tcommon("search")}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
              className="gap-1"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
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
                {filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {c.city || "-"}
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
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {tcustomers("noCustomers")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
