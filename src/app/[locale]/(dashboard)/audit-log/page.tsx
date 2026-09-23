"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { RefreshCwIcon, SearchIcon } from "lucide-animated";
import { ClipboardList, Loader2, Filter, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { useRealtime } from "@/components/realtime-provider";
import { DataExportButton } from "@/components/data-export-button";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  user: { name: string; role: string };
  createdAt: string;
  formattedDate: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AuditLogPage() {
  const taudit = useTranslations("audit");
  const tcommon = useTranslations("common");
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { globalRefreshTrigger } = useRealtime();

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (actionFilter) params.set("action", actionFilter);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        params.set("page", String(page));
        params.set("limit", "25");

        const res = await fetch(`/api/audit-log?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, actionFilter, dateFrom, dateTo],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch when debounced search or global refresh changes
  useEffect(() => {
    const load = async () => {
      await fetchLogs(1);
    };
    load();
  }, [fetchLogs, globalRefreshTrigger]);

  const handleComplianceReport = async () => {
    try {
      const res = await fetch(`/api/audit-log/compliance-report?days=30`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const report = data.report;
      const lines = [
        `COMPLIANCE REPORT — ${report.period.days}-Day Audit Summary`,
        `Period: ${report.period.from} to ${report.period.to}`,
        ``,
        `Total Activity Events: ${report.totalActivity}`,
        `Total Security Events: ${report.totalSecurityEvents}`,
        ``,
        `Login Activity:`,
        `  Total: ${report.loginActivity.total}`,
        `  Failed: ${report.loginActivity.failed}`,
        `  Success Rate: ${report.loginActivity.successRate}`,
        ``,
        `Action Breakdown:`,
        ...report.actionBreakdown.map((a: any) => `  ${a.action}: ${a.count}`),
        ``,
        `Top Actors:`,
        ...report.topActors.map(
          (a: any) =>
            `  ${a.user?.name || "System"} (${a.user?.role || "SYSTEM"}): ${a.activityCount} events`,
        ),
        ``,
        `Daily Activity:`,
        ...report.dailyActivity.map((d: any) => `  ${d.date}: ${d.count} events`),
      ].join("\n");
      const blob = new Blob([lines], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Compliance report downloaded (${report.period.days}-day summary)`);
    } catch {
      toast.error("Failed to generate report");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExport = () => {
    downloadCsv(
      [
        { key: "userName", header: taudit("user") },
        { key: "action", header: taudit("action") },
        { key: "entity", header: taudit("entity") },
        { key: "details", header: taudit("details") },
        { key: "createdAt", header: taudit("date") },
      ],
      logs.map((log) => ({
        userName: log.user.name,
        action: log.action,
        entity: log.entity || "",
        details: log.details || "",
        createdAt: log.createdAt,
      })),
      `audit-log-${new Date().toISOString().split("T")[0]}`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{taudit("title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {taudit("subtitle")} — {taudit("totalEntries", { count: pagination.total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
          >
            <RefreshCwIcon size={16} className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {tcommon("refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleComplianceReport} className="gap-2">
            <Download className="h-4 w-4" />
            Compliance Report
          </Button>
          <DataExportButton
            columns={[
              { key: (l: AuditEntry) => l.user.name, header: "User" },
              { key: "action", header: "Action" },
              { key: (l: AuditEntry) => l.entity || "", header: "Entity" },
              { key: (l: AuditEntry) => l.details || "", header: "Details" },
              { key: (l: AuditEntry) => l.formattedDate || l.createdAt, header: "Date" },
              { key: (l: AuditEntry) => l.user.role, header: "Role" },
            ]}
            data={logs}
            filename={`audit-log-${new Date().toISOString().split("T")[0]}`}
            label={taudit("export")}
            showColumnSelector
            totalCount={pagination.total}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
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
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {(actionFilter || dateFrom || dateTo) && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 items-end p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="flex h-9 w-[180px] rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All actions</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="PASSWORD">Password</option>
                  <option value="MFA">MFA/2FA</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              {(actionFilter || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActionFilter("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Results */}
          {!loading && (
            <>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "mt-1.5 w-2 h-2 rounded-full shrink-0",
                          getActionColor(log.action),
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {log.user.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {log.action}
                          </Badge>
                          {log.entity && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-gray-100 dark:bg-gray-800"
                            >
                              {log.entity}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] text-gray-400 dark:text-gray-500"
                          >
                            {log.user.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {log.details || taudit("details")}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{log.formattedDate}</p>
                      </div>
                    </div>
                  ))}

                  {/* Empty state */}
                  {logs.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-500">
                      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {taudit("noLogs")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{taudit("subtitle")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-gray-500">
                    {taudit("pageInfo", {
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                      total: pagination.total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchLogs(Math.max(1, pagination.page - 1))}
                    >
                      {taudit("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLogs(pagination.page + 1)}
                    >
                      {taudit("next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getActionColor(action: string): string {
  if (action.includes("CREATE") || action.includes("LOGIN")) return "bg-green-500";
  if (action.includes("UPDATE") || action.includes("PROCESS")) return "bg-blue-500";
  if (action.includes("DELETE") || action.includes("CANCEL")) return "bg-red-500";
  return "bg-gray-400 dark:bg-gray-500";
}
