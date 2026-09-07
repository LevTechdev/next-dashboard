"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PlusIcon, UsersRoundIcon, SearchIcon, ClockIcon, ShieldCheckIcon } from "lucide-animated";
import { Mail } from "lucide-react";
import { Edit2, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getStatusColor, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { DataExportButton } from "@/components/data-export-button";

// Mock activity data
const MOCK_ACTIVITY = [
  {
    id: "a-1",
    user: "Admin",
    action: "Updated team member role",
    target: "sarah@dashboard.com",
    timestamp: "2 hours ago",
  },
  {
    id: "a-2",
    user: "Admin",
    action: "Created new API key",
    target: "Production Key",
    timestamp: "5 hours ago",
  },
  {
    id: "a-3",
    user: "Sarah",
    action: "Logged in",
    target: "Chrome / macOS",
    timestamp: "1 day ago",
  },
  {
    id: "a-4",
    user: "Admin",
    action: "Invited new member",
    target: "alex@example.com",
    timestamp: "2 days ago",
  },
  {
    id: "a-5",
    user: "Admin",
    action: "Changed password",
    target: "Account settings",
    timestamp: "3 days ago",
  },
];

// Permission matrix data
const PERMISSIONS_MATRIX = [
  {
    resource: "Dashboard",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: true, STAFF: true, AUDITOR: true },
  },
  {
    resource: "Orders",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: true, STAFF: true, AUDITOR: true },
  },
  {
    resource: "Products",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: true, STAFF: false, AUDITOR: true },
  },
  {
    resource: "Customers",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: true, STAFF: false, AUDITOR: true },
  },
  {
    resource: "Team",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: false, STAFF: false, AUDITOR: false },
  },
  {
    resource: "Settings",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: false, STAFF: false, AUDITOR: false },
  },
  {
    resource: "Billing",
    roles: { SUPER_ADMIN: true, ADMIN: false, MANAGER: false, STAFF: false, AUDITOR: false },
  },
  {
    resource: "Audit Log",
    roles: { SUPER_ADMIN: true, ADMIN: true, MANAGER: false, STAFF: false, AUDITOR: true },
  },
];

export default function TeamPage() {
  const tteam = useTranslations("team");
  const tcommon = useTranslations("common");
  const { user } = useAuth();
  const role = (user as any)?.role;

  const [members, setMembers] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    position: "",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "STAFF",
    allowedChannels: ["Online Store", "Instagram"] as string[],
    expiresInDays: 7,
  });
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [editInviteDialogOpen, setEditInviteDialogOpen] = useState(false);
  const [editInviteSaving, setEditInviteSaving] = useState(false);
  const [editInviteForm, setEditInviteForm] = useState<{
    id: string;
    email: string;
    role: string;
    allowedChannels: string[];
    expiresInDays: number;
  } | null>(null);

  const loadData = () => {
    fetch("/api/team", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setMembers(data);
        setLoading(false);
      });
  };

  const loadInvitations = () => {
    fetch("/api/team/invitations", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { invitations: [] }))
      .then((data) => setInvitations(data.invitations || []));
  };

  useEffect(() => {
    loadData();
    loadInvitations();
  }, []);

  const filtered = members.filter((m: any) => m.name?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    const method = editMember ? "PUT" : "POST";
    const body = editMember ? { ...form, id: editMember.id } : form;
    const res = await fetch("/api/team", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(editMember ? tteam("memberUpdated") : tteam("memberAdded"));
    setDialogOpen(false);
    setEditMember(null);
    setForm({ name: "", email: "", password: "", role: "STAFF", position: "" });
    loadData();
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: tteam("removeBtn"),
      description: tteam("confirmRemove"),
      confirmLabel: tteam("removeBtn"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error(tcommon("error"));
      return;
    }
    toast.success(tteam("memberRemoved"));
    loadData();
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setInviteSaving(true);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (res.ok) {
        toast.success(tteam("inviteSent"));
        setInviteDialogOpen(false);
        setInviteForm({
          email: "",
          role: "STAFF",
          allowedChannels: ["Online Store", "Instagram"],
          expiresInDays: 7,
        });
        loadInvitations();
      } else {
        toast.error("Failed to send invitation");
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setInviteSaving(false);
    }
  };

  const handleOpenEditInvite = (inv: any) => {
    setEditInviteForm({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      allowedChannels: Array.isArray(inv.allowedChannels) ? [...inv.allowedChannels] : [],
      expiresInDays: 7,
    });
    setEditInviteDialogOpen(true);
  };

  const handleSaveEditInvite = async () => {
    if (!editInviteForm) return;
    setEditInviteSaving(true);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editInviteForm.id,
          role: editInviteForm.role,
          allowedChannels: editInviteForm.allowedChannels,
          expiresInDays: editInviteForm.expiresInDays,
        }),
      });
      if (res.ok) {
        toast.success(tteam("inviteUpdated"));
        setEditInviteDialogOpen(false);
        setEditInviteForm(null);
        loadInvitations();
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setEditInviteSaving(false);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    const ok = await confirm({
      title: tteam("revokeInviteTitle"),
      description: tteam("revokeInviteConfirm"),
      confirmLabel: tteam("removeBtn"),
      destructive: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/team/invitations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(tteam("inviteRevoked"));
        loadInvitations();
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tteam("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tteam("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DataExportButton
            columns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email" },
              { key: "role", header: "Role" },
              { key: (m: any) => m.position || "-", header: "Position" },
              { key: (m: any) => (m.isActive ? "Active" : "Inactive"), header: "Status" },
              { key: (m: any) => new Date(m.createdAt).toLocaleDateString(), header: "Joined" },
            ]}
            data={filtered}
            filename={`team-export-${new Date().toISOString().split("T")[0]}`}
            label="Export"
            showColumnSelector
            totalCount={members.length}
          />
          {can(role, "create", "team") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
                className="gap-1.5"
              >
                <Mail size={14} className="h-3.5 w-3.5" />
                {tteam("inviteMember")}
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditMember(null);
                      setForm({ name: "", email: "", password: "", role: "STAFF", position: "" });
                    }}
                  >
                    <PlusIcon size={16} className="h-4 w-4 mr-2" /> {tteam("addMember")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editMember
                        ? `${tcommon("edit")} ${tteam("memberList")}`
                        : tteam("addMember")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder={tteam("name")}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <Input
                      placeholder={tteam("email")}
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                      placeholder={tteam("position")}
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                    />
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">{tteam("superAdmin")}</SelectItem>
                        <SelectItem value="ADMIN">{tteam("admin")}</SelectItem>
                        <SelectItem value="MANAGER">{tteam("manager")}</SelectItem>
                        <SelectItem value="STAFF">{tteam("staff")}</SelectItem>
                        <SelectItem value="AUDITOR">{tteam("auditor")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!editMember && (
                      <Input
                        placeholder={tteam("passwordPlaceholder")}
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    )}
                    <Button onClick={handleSave} className="w-full">
                      {editMember ? tteam("updateMember") : tteam("addMemberSubmit")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tteam("inviteMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <Input
                placeholder="colleague@company.com"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Workspace Role</label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tteam("inviteRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">{tteam("roleOwner")}</SelectItem>
                  <SelectItem value="ADMIN">{tteam("admin")}</SelectItem>
                  <SelectItem value="MANAGER">{tteam("manager")}</SelectItem>
                  <SelectItem value="STAFF">{tteam("staff")}</SelectItem>
                  <SelectItem value="VIEWER">{tteam("roleViewer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-1 border-t border-border/50">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{tteam("salesChannelAccess")}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {tteam("orderManagementScope")}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/60">
                {["Online Store", "Instagram", "TikTok Shop", "Shopify", "Facebook"].map((ch) => {
                  const checked = inviteForm.allowedChannels.includes(ch);
                  return (
                    <label
                      key={ch}
                      className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInviteForm((prev) => ({
                              ...prev,
                              allowedChannels: [...prev.allowedChannels, ch],
                            }));
                          } else {
                            setInviteForm((prev) => ({
                              ...prev,
                              allowedChannels: prev.allowedChannels.filter((c) => c !== ch),
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>{ch}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {tteam("invitationExpiry")}
              </label>
              <Select
                value={String(inviteForm.expiresInDays)}
                onValueChange={(v) =>
                  setInviteForm({ ...inviteForm, expiresInDays: parseInt(v, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24 Hours (High Security)</SelectItem>
                  <SelectItem value="7">7 Days (Standard)</SelectItem>
                  <SelectItem value="30">30 Days (Extended)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleInvite}
              disabled={inviteSaving || !inviteForm.email}
              className="w-full"
            >
              {inviteSaving ? "Sending Invitation..." : tteam("inviteMember")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Invitation Dialog */}
      <Dialog open={editInviteDialogOpen} onOpenChange={setEditInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tteam("editInvitation")}</DialogTitle>
            <p className="text-xs text-muted-foreground">{tteam("editInvitationDesc")}</p>
          </DialogHeader>
          {editInviteForm && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {tteam("inviteEmail")}
                </label>
                <Input
                  value={editInviteForm.email}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {tteam("inviteRole")}
                </label>
                <Select
                  value={editInviteForm.role}
                  onValueChange={(v) => setEditInviteForm({ ...editInviteForm, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{tteam("admin")}</SelectItem>
                    <SelectItem value="MANAGER">{tteam("manager")}</SelectItem>
                    <SelectItem value="STAFF">{tteam("staff")}</SelectItem>
                    <SelectItem value="VIEWER">{tteam("roleViewer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-1 border-t border-border/50">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{tteam("salesChannelAccess")}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {tteam("orderManagementScope")}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/60">
                  {["Online Store", "Instagram", "TikTok Shop", "Shopify", "Facebook"].map((ch) => {
                    const checked = editInviteForm.allowedChannels.includes(ch);
                    return (
                      <label
                        key={ch}
                        className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditInviteForm((prev) =>
                                prev
                                  ? { ...prev, allowedChannels: [...prev.allowedChannels, ch] }
                                  : null,
                              );
                            } else {
                              setEditInviteForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      allowedChannels: prev.allowedChannels.filter((c) => c !== ch),
                                    }
                                  : null,
                              );
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{ch}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {tteam("invitationExpiry")}
                </label>
                <Select
                  value={String(editInviteForm.expiresInDays)}
                  onValueChange={(v) =>
                    setEditInviteForm({ ...editInviteForm, expiresInDays: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">24 Hours (High Security)</SelectItem>
                    <SelectItem value="7">7 Days (Standard)</SelectItem>
                    <SelectItem value="30">30 Days (Extended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveEditInvite} disabled={editInviteSaving} className="w-full">
                {editInviteSaving ? "Saving..." : tteam("saveInvitation")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-1.5">
            <UsersRoundIcon size={14} className="h-3.5 w-3.5" />
            {tteam("memberList")}
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-1.5">
            <Mail size={14} className="h-3.5 w-3.5" />
            {tteam("invitations")}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <ClockIcon size={14} className="h-3.5 w-3.5" />
            {tteam("activity")}
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5">
            <ShieldCheckIcon size={14} className="h-3.5 w-3.5" />
            {tteam("permissions")}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-sm">
                <SearchIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                />
                <Input
                  placeholder={tcommon("search")}
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
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
                      <TableHead>{tteam("joinedDate")}</TableHead>
                      <TableHead className="text-right">{tcommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700">
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{m.name}</p>
                              <p className="text-xs text-gray-500">{m.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(m.role)}>{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{m.position || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={m.isActive ? "success" : "danger"}>
                            {m.isActive ? tcommon("active") : tcommon("inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {can(role, "update", "team") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditMember(m);
                                setForm({
                                  name: m.name,
                                  email: m.email,
                                  password: "",
                                  role: m.role,
                                  position: m.position || "",
                                });
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 size={14} className="h-3.5 w-3.5 mr-1" />
                              {tteam("editBtn")}
                            </Button>
                          )}
                          {can(role, "delete", "team") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(m.id)}
                              className="text-red-500"
                            >
                              <Trash2 size={14} className="h-3.5 w-3.5 mr-1" />
                              {tteam("removeBtn")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          <UsersRoundIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-50" />{" "}
                          {tteam("noMembers")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>{tteam("invitations")}</CardTitle>
              <CardDescription>{tteam("invitationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">{tteam("noInvitations")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tteam("email")}</TableHead>
                        <TableHead>{tteam("role")}</TableHead>
                        <TableHead>{tteam("channelAccess")}</TableHead>
                        <TableHead>{tteam("inviteExpires")}</TableHead>
                        <TableHead>{tcommon("status")}</TableHead>
                        <TableHead className="text-right">{tcommon("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(inv.role)}>{inv.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {inv.allowedChannels && inv.allowedChannels.length > 0 ? (
                                inv.allowedChannels.map((ch: string) => (
                                  <span
                                    key={ch}
                                    className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium text-foreground border border-border/50"
                                  >
                                    {ch}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {tteam("allChannels")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === "pending"
                                  ? "outline"
                                  : inv.status === "accepted"
                                    ? "success"
                                    : "danger"
                              }
                            >
                              {inv.status === "pending"
                                ? tteam("invitePending")
                                : inv.status === "accepted"
                                  ? tteam("inviteAccepted")
                                  : tteam("inviteExpired")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {inv.status === "pending" && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  onClick={() => handleOpenEditInvite(inv)}
                                >
                                  <Edit2 size={14} className="h-3.5 w-3.5 mr-1 text-sky-500" />
                                  {tteam("editInviteBtn")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => handleRevokeInvite(inv.id)}
                                >
                                  <Trash2 size={14} className="h-3.5 w-3.5 mr-1" />
                                  {tteam("removeBtn")}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>{tteam("activity")}</CardTitle>
              <CardDescription>{tteam("activityDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_ACTIVITY.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold shrink-0">
                      {getInitials(item.user)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.user}</span>{" "}
                        <span className="text-gray-500">{item.action}</span>{" "}
                        <span className="font-medium">{item.target}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>{tteam("permissions")}</CardTitle>
              <CardDescription>{tteam("permissionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tteam("permissions")}</TableHead>
                      {["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "AUDITOR"].map((r) => (
                        <TableHead key={r} className="text-center text-xs">
                          {r.replace("_", " ")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSIONS_MATRIX.map((row) => (
                      <TableRow key={row.resource}>
                        <TableCell className="text-sm font-medium">{row.resource}</TableCell>
                        {["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "AUDITOR"].map((r) => (
                          <TableCell key={r} className="text-center">
                            {row.roles[r as keyof typeof row.roles] ? (
                              <Check size={16} className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
