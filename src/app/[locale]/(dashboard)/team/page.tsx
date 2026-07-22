"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Plus, Users2, Search, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getStatusColor, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { DataExportButton } from "@/components/data-export-button";

export default function TeamPage() {
  const tteam = useTranslations("team");
  const tcommon = useTranslations("common");
  const { user } = useAuth();
  const role = (user as any)?.role;

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF", position: "" });

  const loadData = async () => {
    const res = await fetch("/api/team");
    setMembers(await res.json());
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const filtered = members.filter((m: any) => m.name?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    const method = editMember ? "PUT" : "POST";
    const body = editMember ? { ...form, id: editMember.id } : form;
    await fetch("/api/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    toast.success(editMember ? tteam("memberUpdated") : tteam("memberAdded"));
    setDialogOpen(false);
    setEditMember(null);
    setForm({ name: "", email: "", password: "", role: "STAFF", position: "" });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tteam("confirmRemove"))) return;
    await fetch("/api/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success(tteam("memberRemoved"));
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tteam("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tteam("subtitle")}</p>
        </div>
        <DataExportButton
            columns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email" },
              { key: "role", header: "Role" },
              { key: (m: any) => m.position || "-", header: "Position" },
              { key: (m: any) => m.isActive ? "Active" : "Inactive", header: "Status" },
              { key: (m: any) => new Date(m.createdAt).toLocaleDateString(), header: "Joined" },
            ]}
            data={filtered}
            filename={`team-export-${new Date().toISOString().split("T")[0]}`}
            label="Export"
            showColumnSelector
            totalCount={members.length}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {can(role, "create", "team") && (
          <DialogTrigger asChild>
            <Button onClick={() => { setEditMember(null); setForm({ name: "", email: "", password: "", role: "STAFF", position: "" }); }}>
              <Plus className="h-4 w-4 mr-2" /> {tteam("addMember")}
            </Button>
          </DialogTrigger>
          )}
            <DialogContent>
            <DialogHeader><DialogTitle>{editMember ? `${tcommon("edit")} ${tteam("memberList")}` : tteam("addMember")}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <Input placeholder={tteam("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder={tteam("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder={tteam("position")} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{tteam("admin")}</SelectItem>
                  <SelectItem value="MANAGER">{tteam("manager")}</SelectItem>
                  <SelectItem value="STAFF">{tteam("staff")}</SelectItem>
                </SelectContent>
              </Select>
              {!editMember && <Input placeholder={tteam("passwordPlaceholder")} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
              <Button onClick={handleSave} className="w-full">{editMember ? tteam("updateMember") : tteam("addMemberSubmit")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder={tcommon("search")} className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tteam("name")}</TableHead>
                <TableHead>{tteam("role")}</TableHead>
                <TableHead>{tteam("position")}</TableHead>
                <TableHead>{tcommon("status")}</TableHead>
                <TableHead>{tcommon("date")}</TableHead>
                <TableHead className="text-right">{tcommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700">{getInitials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={getStatusColor(m.role)}>{m.role}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-500">{m.position || "-"}</TableCell>
                  <TableCell><Badge variant={m.isActive ? "success" : "danger"}>{m.isActive ? tcommon("active") : tcommon("inactive")}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDate(m.createdAt)}</TableCell><TableCell className="text-right">
                      {can(role, "update", "team") && <Button variant="ghost" size="sm" onClick={() => { setEditMember(m); setForm({ name: m.name, email: m.email, password: "", role: m.role, position: m.position || "" }); setDialogOpen(true); }}>{tteam("editBtn")}</Button>}
                      {can(role, "delete", "team") && <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} className="text-red-500">{tteam("removeBtn")}</Button>}
                    </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500"><Users2 className="h-8 w-8 mx-auto mb-2 opacity-50" /> {tteam("noMembers")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
