"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  productCount: number;
  orderCount: number;
}

export function OrganizationSwitcher() {
  const t = useTranslations("tenants");
  const tcommon = useTranslations("common");
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
        setActiveTenantId(data.activeTenantId || data.tenants?.[0]?.id || null);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSwitch = async (tenant: TenantInfo) => {
    if (tenant.id === activeTenantId) return;
    try {
      setSwitching(true);
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });

      if (res.ok) {
        setActiveTenantId(tenant.id);
        toast.success(t("switchingWorkspaceSuccess", { name: tenant.name }));
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setSwitching(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug) return;
    try {
      setCreating(true);
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success(t("workspaceCreated", { name: created.name }));
        setCreateDialogOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        await fetchTenants();
        await handleSwitch(created);
      } else {
        const err = await res.json();
        toast.error(err.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setCreating(false);
    }
  };

  const activeTenant = tenants.find((t) => t.id === activeTenantId) || tenants[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-2 sm:px-3 border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold"
            disabled={loading || switching}
          >
            {switching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Building2 className="h-3.5 w-3.5 text-primary" />
            )}
            <span className="max-w-[76px] sm:max-w-[120px] md:max-w-[150px] truncate text-gray-800 dark:text-gray-200">
              {activeTenant ? activeTenant.name : t("currentOrganization")}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-gray-400 opacity-70 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-56 p-1.5 shadow-lg border-gray-200 dark:border-gray-800"
        >
          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1">
            {t("switchOrganization")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {tenants.map((item) => {
              const isActive = item.id === activeTenantId;
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleSwitch(item)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 text-xs rounded-md cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60",
                  )}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] text-gray-400 font-normal">/{item.slug}</span>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2 text-xs text-primary font-medium px-2.5 py-2 rounded-md cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("createWorkspace")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Modal */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                {t("createWorkspace")}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {t("createWorkspaceDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  {t("workspaceName")}
                </label>
                <Input
                  placeholder="e.g. Acme Global Studio"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  {t("workspaceSlug")}
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-300 dark:border-gray-700 rounded-l-md text-xs text-gray-500">
                    app/
                  </span>
                  <Input
                    className="rounded-l-none"
                    placeholder="acme-global"
                    value={newOrgSlug}
                    onChange={(e) =>
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {tcommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-medium"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
