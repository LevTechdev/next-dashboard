"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  UsersIcon,
  CreditCardIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
  SearchIcon,
  BanIcon,
  MoreVerticalIcon,
  Loader2Icon,
  UserXIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-provider";
import { AuditHealthCard } from "@/components/admin/audit-health-card";
import { MailHealthCard } from "@/components/admin/mail-health-card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  status: string;
  joinedAt: string;
}

interface PlatformStats {
  totalRevenue: number;
  activeSubscriptions: number;
  totalUsers: number;
  churnRate: string;
}

/**
 * Platform Admin — real user management.
 *
 * Reads live data from GET /api/admin/users (ADMIN-only) and wires the row
 * kebab menu to DELETE /api/admin/users. The backend refuses to hard-delete
 * the last active admin of a tenant (it deactivates instead) and returns
 * `deactivated: true` so the UI can explain the substitution; self-deletion
 * is refused server-side.
 */
export default function AdminDashboardPage() {
  const tcommon = useTranslations("common");
  const tadmin = useTranslations("admin");
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || tadmin("loadFailedStatus", { status: res.status }));
      }
      const data = (await res.json()) as AdminUserRow[];
      setUsers(data);
      // Derive platform stats from the user list — real counts instead of the
      // previous static placeholders.
      setStats({
        totalRevenue: 0, // subscription revenue aggregates live in billing; not exposed here
        activeSubscriptions: data.filter((u) => u.plan !== "Free").length,
        totalUsers: data.length,
        churnRate: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : tadmin("loadFailed"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (user: AdminUserRow) => {
    const ok = await confirm({
      title: tcommon("delete"),
      description: `${user.name} (${user.email}) — ${tcommon("delete")}?`,
      confirmLabel: tcommon("delete"),
      icon: "trash",
      destructive: true,
    });
    if (!ok) return;
    try {
      setDeletingId(user.id);
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.deactivated) {
          toast.info(data.message || tadmin("deactivatedToast"));
        } else {
          toast.success(data.message || tadmin("deletedToast"));
        }
        setUsers((prev) =>
          prev
            ? data.deactivated
              ? prev.map((u) => (u.id === user.id ? { ...u, status: "Banned" } : u))
              : prev.filter((u) => u.id !== user.id)
            : prev,
        );
      } else {
        toast.error(data.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = (users ?? []).filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const roleChip = (role: string) => {
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
    return (
      <span
        className={cn(
          "px-2 py-1 rounded-md text-xs font-medium",
          isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {role}
      </span>
    );
  };

  const planChip = (plan: string) => (
    <span
      className={cn(
        "px-2 py-1 rounded-md text-xs font-medium",
        plan === "Enterprise"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : plan !== "Free"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
      )}
    >
      {plan}
    </span>
  );

  const statusChip = (status: string) => (
    <span
      className={cn(
        "px-2 py-1 rounded-md text-xs font-medium",
        status === "Active"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      )}
    >
      {status}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center">
          <ShieldCheckIcon size={28} className="mr-3 text-red-500" /> Admin
        </h1>
        <p className="text-zinc-500 mt-2">{tadmin("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tadmin("statSubs")}</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-stat-subs">
              {stats ? stats.activeSubscriptions : "—"}
            </div>
            <p className="text-xs text-zinc-500">{tadmin("statSubsHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tadmin("statUsers")}</CardTitle>
            <UsersIcon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-stat-users">
              {stats ? stats.totalUsers : "—"}
            </div>
            <p className="text-xs text-zinc-500">{tadmin("statUsersHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tadmin("statAdmins")}</CardTitle>
            <ShieldCheckIcon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-stat-admins">
              {users
                ? users.filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN").length
                : "—"}
            </div>
            <p className="text-xs text-zinc-500">{tadmin("statAdminsHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tadmin("statBanned")}</CardTitle>
            <BanIcon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-stat-banned">
              {users ? users.filter((u) => u.status !== "Active").length : "—"}
            </div>
            <p className="text-xs text-zinc-500">{tadmin("statBannedHint")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit-event attribution + mail-outbox health (ADMIN-only endpoint). */}
      <AuditHealthCard />
      {/* Live mail-delivery health: transport, sender sanity, failures + resend. */}
      <MailHealthCard />

      <Card>
        <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{tadmin("userManagement")}</CardTitle>
              <CardDescription>{tadmin("userManagementDesc")}</CardDescription>
            </div>
            <div className="relative w-64">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <Input
                placeholder={tadmin("searchPlaceholder")}
                className="pl-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-500">{error}</div>
          ) : (
            <Table>
              <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableRow>
                  <TableHead className="pl-6">{tadmin("name")}</TableHead>
                  <TableHead>{tadmin("email")}</TableHead>
                  <TableHead>{tadmin("role")}</TableHead>
                  <TableHead>{tadmin("plan")}</TableHead>
                  <TableHead>{tadmin("status")}</TableHead>
                  <TableHead>{tadmin("joined")}</TableHead>
                  <TableHead className="text-right pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                      {tadmin("noUsers")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      data-testid="admin-user-row"
                      data-user-email={user.email}
                    >
                      <TableCell className="pl-6 font-medium text-zinc-900 dark:text-zinc-100">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-zinc-500">{user.email}</TableCell>
                      <TableCell>{roleChip(user.role)}</TableCell>
                      <TableCell>{planChip(user.plan)}</TableCell>
                      <TableCell>{statusChip(user.status)}</TableCell>
                      <TableCell className="text-zinc-500">
                        {formatDateTime(user.joinedAt)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={tadmin("actionsFor", { name: user.name })}
                            >
                              {deletingId === user.id ? (
                                <Loader2Icon size={14} className="animate-spin" />
                              ) : (
                                <MoreVerticalIcon size={14} />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => handleDelete(user)}
                              disabled={deletingId === user.id || (me ? user.id === me.id : false)}
                              className="text-red-600 dark:text-red-400 focus:text-red-600 cursor-pointer"
                            >
                              <UserXIcon size={14} className="mr-2" />
                              {tadmin("deleteUser")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
