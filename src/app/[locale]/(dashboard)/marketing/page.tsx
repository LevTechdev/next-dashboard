"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-animated";
import { Megaphone, Edit2, Trash2 } from "lucide-react";
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
import { formatCurrency, getStatusColor, sanitizeInteger } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";

export default function MarketingPage() {
  const { user } = useAuth();
  const tmarketing = useTranslations("marketing");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();
  const role = (user as any)?.role;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "EMAIL",
    channel: "",
    budget: "",
    spent: "",
    status: "DRAFT",
  });

  const loadData = () => {
    fetch("/api/marketing", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      });
  };
  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
          <div className="h-9 w-40 shimmer rounded-lg" />
        </div>
        <div>
          <div className="h-12 shimmer rounded-t-lg" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 shimmer border-t border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const method = editCampaign ? "PUT" : "POST";
    const body = editCampaign ? { ...form, id: editCampaign.id } : form;
    const res = await fetch("/api/marketing", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(editCampaign ? tmarketing("updated") : tmarketing("added"));
    setDialogOpen(false);
    setEditCampaign(null);
    setForm({
      name: "",
      description: "",
      type: "EMAIL",
      channel: "",
      budget: "",
      spent: "",
      status: "DRAFT",
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: tcommon("delete"),
      description: tmarketing("confirmDelete"),
      confirmLabel: tcommon("delete"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/marketing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(tmarketing("deleted"));
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tmarketing("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tmarketing("subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {can(role, "create", "marketing") && (
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditCampaign(null);
                  setForm({
                    name: "",
                    description: "",
                    type: "EMAIL",
                    channel: "",
                    budget: "",
                    spent: "",
                    status: "DRAFT",
                  });
                }}
              >
                {" "}
                <PlusIcon size={16} className="h-4 w-4 mr-2" /> {tmarketing("addCampaign")}
              </Button>
            </DialogTrigger>
          )}{" "}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editCampaign ? tmarketing("editCampaign") : tmarketing("addCampaign")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder={tmarketing("name")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder={tcommon("description")}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={tmarketing("type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SOCIAL">Social Media</SelectItem>
                    <SelectItem value="ADS">Paid Ads</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tmarketing("channel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="google">Google Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder={tmarketing("budget")}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: sanitizeInteger(e.target.value) })}
                />
                <Input
                  placeholder={tmarketing("spent")}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={form.spent}
                  onChange={(e) => setForm({ ...form, spent: sanitizeInteger(e.target.value) })}
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                {editCampaign ? tmarketing("editCampaign") : tmarketing("addCampaign")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tmarketing("name")}</TableHead>
                  <TableHead>{tmarketing("type")}</TableHead>
                  <TableHead>{tmarketing("channel")}</TableHead>
                  <TableHead>{tmarketing("budget")}</TableHead>
                  <TableHead>{tmarketing("spent")}</TableHead>
                  <TableHead>{tmarketing("roi")}</TableHead>
                  <TableHead>{tmarketing("status")}</TableHead>
                  <TableHead className="text-right">{tcommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c: any) => {
                  const roi =
                    c.spent > 0 ? (((c.budget - c.spent) / c.spent) * 100).toFixed(0) : "0";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.type}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{c.channel || "-"}</TableCell>
                      <TableCell>{formatCurrency(c.budget)}</TableCell>
                      <TableCell>{formatCurrency(c.spent)}</TableCell>
                      <TableCell>
                        <Badge variant={parseInt(roi) > 0 ? "success" : "danger"}>{roi}%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {can(role, "update", "marketing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditCampaign(c);
                              setForm({
                                name: c.name,
                                description: c.description || "",
                                type: c.type,
                                channel: c.channel || "",
                                budget: c.budget.toString(),
                                spent: c.spent.toString(),
                                status: c.status,
                              });
                              setDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            {tcommon("edit")}
                          </Button>
                        )}
                        {can(role, "delete", "marketing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(c.id)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {tcommon("delete")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" /> {tcommon("noData")}
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
