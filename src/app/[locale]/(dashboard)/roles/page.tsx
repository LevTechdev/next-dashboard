"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  SearchIcon,
  CircleCheckIcon,
  SlidersHorizontalIcon,
  RotateCcwIcon,
  LockIcon,
} from "lucide-animated";
import { Shield, Users2, Save, Loader2, XCircle, AlertTriangle, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  MANAGER:
    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  STAFF:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
};

const RESOURCE_KEYS = [
  "dashboard",
  "analytics",
  "sales",
  "orders",
  "customers",
  "products",
  "inventory",
  "marketing",
  "discounts",
  "reports",
  "team",
  "settings",
  "profile",
  "audit-log",
  "roles",
];

// System defaults — mirrors src/lib/permissions.ts PAGE_ACCESS
const SYSTEM_PAGE_DEFAULTS: Record<string, string[]> = {
  dashboard: ["ADMIN", "MANAGER", "STAFF"],
  analytics: ["ADMIN", "MANAGER"],
  sales: ["ADMIN", "MANAGER", "STAFF"],
  orders: ["ADMIN", "MANAGER", "STAFF"],
  customers: ["ADMIN", "MANAGER"],
  products: ["ADMIN", "MANAGER"],
  inventory: ["ADMIN", "MANAGER"],
  marketing: ["ADMIN", "MANAGER"],
  discounts: ["ADMIN", "MANAGER"],
  reports: ["ADMIN", "MANAGER"],
  team: ["ADMIN"],
  settings: ["ADMIN"],
  profile: ["ADMIN", "MANAGER", "STAFF"],
  "audit-log": ["ADMIN"],
  roles: ["ADMIN"],
};

interface RoleSetting {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

// Determine the effective permission for a (resource, role, action)
// Priority: pending changes → DB overrides → system defaults
function getEffectiveAccess(
  resource: string,
  role: string,
  action: string,
  pending: { id: string; allowed: boolean }[],
  dbSettings: RoleSetting[],
): boolean {
  // 1. Check pending changes (saved or new)
  const setting = dbSettings.find(
    (s) => s.role === role && s.resource === resource && s.action === action,
  );
  if (setting) {
    const pendingChange = pending.find((c) => c.id === setting.id);
    if (pendingChange) return pendingChange.allowed;
  }
  const pendingNew = pending.find((c) => c.id === `new-${role}-${resource}-${action}`);
  if (pendingNew) return pendingNew.allowed;

  // 2. Check already-saved DB override
  if (setting) return setting.allowed;

  // 3. Fall back to system default
  if (action === "access") {
    const allowedRoles = SYSTEM_PAGE_DEFAULTS[resource];
    return allowedRoles?.includes(role) ?? false;
  }
  if (action === "read") return ["ADMIN", "MANAGER", "STAFF"].includes(role);
  // create / update / delete
  return ["ADMIN", "MANAGER"].includes(role);
}

export default function RolesPage() {
  const tcommon = useTranslations("common");
  const troles = useTranslations("roles");

  const getResourceLabel = useCallback(
    (resource: string) => {
      return troles(`res_${resource.replace(/-/g, "_")}`);
    },
    [troles],
  );
  const { user } = useAuth();
  const role = (user as any)?.role;

  const [roleSettings, setRoleSettings] = useState<RoleSetting[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");
  const [dirty, setDirty] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ id: string; allowed: boolean }[]>([]);

  const loadData = () => {
    fetch("/api/roles", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setRoleSettings(data.roleSettings || []);
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error(troles("loadFailed"));
        setLoading(false);
      });
  };
  useEffect(() => {
    loadData();
  }, []);

  const getOverrideSetting = (
    resource: string,
    role: string,
    action: string,
  ): RoleSetting | undefined => {
    return roleSettings.find(
      (s) => s.role === role && s.resource === resource && s.action === action,
    );
  };

  const getToggleState = (resource: string, role: string, action: string): boolean => {
    return getEffectiveAccess(resource, role, action, pendingChanges, roleSettings);
  };

  const togglePermission = (
    setting: RoleSetting | undefined,
    resource: string,
    role: string,
    action: string,
  ) => {
    const current = getToggleState(resource, role, action);
    const newAllowed = !current;

    if (setting) {
      const existingIdx = pendingChanges.findIndex((c) => c.id === setting.id);
      if (existingIdx >= 0) {
        const updated = [...pendingChanges];
        updated[existingIdx] = { id: setting.id, allowed: newAllowed };
        setPendingChanges(updated);
      } else {
        setPendingChanges([...pendingChanges, { id: setting.id, allowed: newAllowed }]);
      }
    } else {
      setPendingChanges([
        ...pendingChanges,
        { id: `new-${role}-${resource}-${action}`, allowed: newAllowed },
      ]);
    }
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    let success = 0;
    let errors = 0;

    for (const change of pendingChanges) {
      try {
        if (change.id.startsWith("new-")) {
          const parts = change.id.replace("new-", "").split("-");
          const action = parts.pop()!;
          const role = parts.pop()!;
          const resource = parts.join("-");
          const res = await fetch("/api/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role, resource, action, allowed: change.allowed }),
          });
          if (!res.ok) throw new Error("save failed");
        } else {
          const res = await fetch("/api/roles", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: change.id, allowed: change.allowed }),
          });
          if (!res.ok) throw new Error("save failed");
        }
        success++;
      } catch {
        errors++;
      }
    }

    if (errors > 0) {
      toast.error(troles("saveFailed", { errors }));
    } else if (success > 0) {
      toast.success(troles("saveSuccess", { success }));
    }

    setPendingChanges([]);
    setDirty(false);
    setSaving(false);
    loadData();
  };

  const handleReset = () => {
    setPendingChanges([]);
    setDirty(false);
    toast.info(troles("changesDiscarded"));
  };

  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1;
    }
    return counts;
  }, [users]);

  const filteredResources = RESOURCE_KEYS.filter(
    (r) =>
      r.toLowerCase().includes(search.toLowerCase()) ||
      getResourceLabel(r).toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{troles("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{troles("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RotateCcwIcon size={16} className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {tcommon("save")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <Card key={r} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield
                    className={cn(
                      "h-5 w-5",
                      r === "ADMIN"
                        ? "text-purple-500"
                        : r === "MANAGER"
                          ? "text-blue-500"
                          : "text-emerald-500",
                    )}
                  />
                  <h3 className="font-semibold">{r}</h3>
                </div>{" "}
                <Badge className={ROLE_COLORS[r]}>
                  {troles("roleUsers", { count: usersByRole[r] || 0 })}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {r === "ADMIN"
                  ? troles("roleDescAdmin")
                  : r === "MANAGER"
                    ? troles("roleDescManager")
                    : troles("roleDescStaff")}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["dashboard", "orders", "customers", "products"] as const).map((res) => {
                  const access = getToggleState(res, r, "access");
                  return (
                    <Badge
                      key={res}
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        access
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-300 border-red-200 dark:border-red-800",
                      )}
                    >
                      {access ? getResourceLabel(res) : "✗"}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Permission Matrix / User Role Summary */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="matrix" className="gap-2">
            <SlidersHorizontalIcon size={16} className="h-4 w-4" />
            {troles("tabMatrix")}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users2 className="h-4 w-4" />
            {troles("tabUsers")}
          </TabsTrigger>
        </TabsList>

        {/* ───────────────── Tab 1: Permission Matrix ───────────────── */}
        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LockIcon size={16} className="h-4 w-4" />
                  {troles("resourcePermissions")}
                </CardTitle>
                <div className="relative max-w-xs w-full">
                  <SearchIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  />
                  <Input
                    placeholder={troles("searchResources")}
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <div className="min-w-[800px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pb-3 px-4 sticky left-0 bg-white dark:bg-gray-950 z-10 min-w-[160px]">
                        {troles("colResource")}
                      </th>
                      {ROLES.map((r) => (
                        <th key={r} colSpan={3} className="text-center pb-3 px-1">
                          <Badge className={cn("text-xs", ROLE_COLORS[r])}>{r}</Badge>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 px-4 sticky left-0 bg-white dark:bg-gray-950 z-10"></th>
                      {ROLES.map((r) =>
                        ["access", "create", "delete"].map((action) => (
                          <th key={`${r}-${action}`} className="text-center pb-2 px-1">
                            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                              {troles(`action${action.charAt(0).toUpperCase() + action.slice(1)}`)}
                            </span>
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResources.map((resource) => (
                      <tr
                        key={resource}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group"
                      >
                        <td className="py-3 px-4 sticky left-0 bg-white dark:bg-gray-950 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {getResourceLabel(resource)}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono text-gray-400"
                            >
                              {resource}
                            </Badge>
                          </div>
                        </td>
                        {ROLES.map((r) =>
                          ["access", "create", "delete"].map((action) => {
                            const setting = getOverrideSetting(resource, r, action);
                            const allowed = getToggleState(resource, r, action);
                            const isPending = pendingChanges.some(
                              (c) =>
                                c.id === setting?.id || c.id === `new-${r}-${resource}-${action}`,
                            );

                            const pageOnlyResources = [
                              "dashboard",
                              "analytics",
                              "sales",
                              "inventory",
                              "reports",
                              "audit-log",
                              "profile",
                            ];
                            const isDisabled =
                              pageOnlyResources.includes(resource) && action !== "access";

                            return (
                              <td
                                key={`${r}-${resource}-${action}`}
                                className="py-1.5 px-1 text-center"
                              >
                                {!isDisabled ? (
                                  <button
                                    onClick={() => togglePermission(setting, resource, r, action)}
                                    className={cn(
                                      "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150",
                                      isPending &&
                                        "ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-gray-900",
                                      allowed
                                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30",
                                    )}
                                    title={
                                      allowed
                                        ? troles("toggleRevoke", {
                                            action,
                                            resource: getResourceLabel(resource),
                                            role: r,
                                          })
                                        : troles("toggleGrant", {
                                            action,
                                            resource: getResourceLabel(resource),
                                            role: r,
                                          })
                                    }
                                  >
                                    {allowed ? (
                                      <CircleCheckIcon size={16} className="h-4 w-4" />
                                    ) : (
                                      <XCircle className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-8 h-8 text-gray-300 dark:text-gray-600">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          }),
                        )}
                      </tr>
                    ))}
                    {filteredResources.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-gray-500">
                          <SearchIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          {troles("noMatch", { search })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 px-4 sm:px-0">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CircleCheckIcon size={14} className="h-3.5 w-3.5 text-green-500" />
                  {troles("legendAllowed")}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  {troles("legendDenied")}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <AlertTriangle className="h-3.5 w-3.5 text-indigo-500" />
                  {troles("legendPending")}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────────── Tab 2: User Role Summary ───────────────── */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="h-4 w-4" />
                {troles("teamRoleAssignments")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <TableHead>{troles("colUser")}</TableHead>
                      <TableHead>{troles("colRole")}</TableHead>
                      <TableHead>{troles("colStatus")}</TableHead>
                      <TableHead className="text-right">{troles("colActions")}</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {u.name}
                            </p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={ROLE_COLORS[u.role]}>{u.role}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={u.isActive ? "success" : "danger"}>
                            {u.isActive ? tcommon("active") : tcommon("inactive")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.location.href = window.location.pathname.replace(
                                /\/roles(\/.*)?$/,
                                "/team",
                              );
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                            {troles("manageInTeam")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg p-4 transition-all duration-300">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm font-medium">
                {troles(pendingChanges.length === 1 ? "unsavedCount" : "unsavedCount_plural", {
                  count: pendingChanges.length,
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RotateCcwIcon size={16} className="h-4 w-4 mr-2" />
                {troles("discard")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {troles("saveAll")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── helper component for table headers ─────────────────────────────── */
function TableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pb-3 px-4",
        className,
      )}
    >
      {children}
    </th>
  );
}
