"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon, DownloadIcon } from "lucide-animated";
import { Tag, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCurrency, formatDate, getStatusColor, sanitizeInteger } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { DataExportButton } from "@/components/data-export-button";

export default function DiscountsPage() {
  const { user } = useAuth();
  const tdiscounts = useTranslations("discounts");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();
  const role = (user as any)?.role;

  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState<any>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    type: "PERCENTAGE",
    value: "",
    minPurchase: "",
    maxUses: "",
    startsAt: "",
    endsAt: "",
  });

  const loadData = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    setDiscounts(await res.json());
    setLoading(false);
  };
  useEffect(() => {
    const init = async () => {
      await loadData();
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
          <div className="h-9 w-36 shimmer rounded-lg" />
        </div>
        <div>
          <div className="h-12 shimmer rounded-t-lg" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 shimmer border-t border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const method = editDiscount ? "PUT" : "POST";
    const body = editDiscount ? { ...form, id: editDiscount.id } : form;
    const res = await fetch("/api/discounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(editDiscount ? tdiscounts("updated") : tdiscounts("added"));
    setDialogOpen(false);
    setEditDiscount(null);
    setForm({
      code: "",
      name: "",
      description: "",
      type: "PERCENTAGE",
      value: "",
      minPurchase: "",
      maxUses: "",
      startsAt: "",
      endsAt: "",
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: tcommon("delete"),
      description: tdiscounts("confirmDelete"),
      confirmLabel: tcommon("delete"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/discounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(tdiscounts("deleted"));
    loadData();
  };

  const isExpired = (endsAt: string) => new Date(endsAt) < new Date();
  const isActive = (d: any) => d.isActive && !isExpired(d.endsAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tdiscounts("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tdiscounts("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExportButton
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Name" },
              { key: (d: any) => (d.type === "PERCENTAGE" ? "%" : "Fixed"), header: "Type" },
              {
                key: (d: any) => (d.type === "PERCENTAGE" ? `${d.value}%` : d.value),
                header: "Value",
              },
              {
                key: (d: any) => (d.minPurchase > 0 ? d.minPurchase : "-"),
                header: "Min Purchase",
              },
              { key: (d: any) => `${d.usedCount}/${d.maxUses || "∞"}`, header: "Used" },
              { key: (d: any) => new Date(d.endsAt).toLocaleDateString(), header: "Valid Until" },
              {
                key: (d: any) =>
                  d.isActive && !(new Date(d.endsAt) < new Date()) ? "Active" : "Expired",
                header: "Status",
              },
            ]}
            data={discounts}
            filename={`discounts-export-${new Date().toISOString().split("T")[0]}`}
            label="Export"
            showColumnSelector
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {can(role, "create", "discounts") && (
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditDiscount(null);
                    setForm({
                      code: "",
                      name: "",
                      description: "",
                      type: "PERCENTAGE",
                      value: "",
                      minPurchase: "",
                      maxUses: "",
                      startsAt: "",
                      endsAt: "",
                    });
                  }}
                >
                  {" "}
                  <PlusIcon size={16} className="h-4 w-4 mr-2" /> {tdiscounts("addDiscount")}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editDiscount ? tdiscounts("editDiscount") : tdiscounts("addDiscount")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={tdiscounts("code")}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                  <Input
                    placeholder={tdiscounts("name")}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <Input
                  placeholder={tcommon("description")}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v, value: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">{tdiscounts("percentage")}</SelectItem>
                      <SelectItem value="FIXED">{tdiscounts("fixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={tdiscounts("value")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: sanitizeInteger(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={tdiscounts("minPurchase")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.minPurchase}
                    onChange={(e) =>
                      setForm({ ...form, minPurchase: sanitizeInteger(e.target.value) })
                    }
                  />
                  <Input
                    placeholder={tdiscounts("maxUses")}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: sanitizeInteger(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={tdiscounts("validFrom")}
                    type="date"
                    value={form.startsAt?.split("T")[0]}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                  <Input
                    placeholder={tdiscounts("validUntil")}
                    type="date"
                    value={form.endsAt?.split("T")[0]}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editDiscount ? tdiscounts("editDiscount") : tdiscounts("addDiscount")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tdiscounts("code")}</TableHead>
                  <TableHead>{tdiscounts("name")}</TableHead>
                  <TableHead>{tdiscounts("type")}</TableHead>
                  <TableHead>{tdiscounts("value")}</TableHead>
                  <TableHead>{tdiscounts("minPurchase")}</TableHead>
                  <TableHead>{tdiscounts("used")}</TableHead>
                  <TableHead>{tdiscounts("validUntil")}</TableHead>
                  <TableHead>{tdiscounts("status")}</TableHead>
                  <TableHead className="text-right">{tcommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono font-bold text-indigo-600">{d.code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.type === "PERCENTAGE" ? "%" : tdiscounts("fixed")}</TableCell>
                    <TableCell className="font-medium">
                      {d.type === "PERCENTAGE" ? `${d.value}%` : formatCurrency(d.value)}
                    </TableCell>
                    <TableCell>{d.minPurchase > 0 ? formatCurrency(d.minPurchase) : "-"}</TableCell>
                    <TableCell>
                      {d.usedCount}/{d.maxUses || "∞"}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(d.endsAt)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isActive(d) ? getStatusColor("ACTIVE") : getStatusColor("CANCELLED")
                        }
                      >
                        {isActive(d) ? tcommon("active") : tcommon("expired")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {can(role, "update", "discounts") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditDiscount(d);
                            setForm({
                              code: d.code,
                              name: d.name,
                              description: d.description || "",
                              type: d.type,
                              value: d.value.toString(),
                              minPurchase: d.minPurchase.toString(),
                              maxUses: d.maxUses.toString(),
                              startsAt: d.startsAt?.split("T")[0] || "",
                              endsAt: d.endsAt?.split("T")[0] || "",
                            });
                            setDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          {tcommon("edit")}
                        </Button>
                      )}
                      {can(role, "delete", "discounts") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(d.id)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {tcommon("delete")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {discounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" /> {tcommon("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
