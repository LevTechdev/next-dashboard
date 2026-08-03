"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import {
  CheckIcon,
  XIcon,
  ClockIcon,
  RefreshCwIcon,
  ZapIcon,
  UsersIcon,
  FileTextIcon,
  CreditCardIcon,
  BanIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  DownloadIcon,
} from "lucide-animated";
import { ShoppingCart, Shield, BarChart3, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  interval: string;
  features: string[];
  maxOrders: number | null;
  maxTeamMembers: number | null;
  hasAnalytics: boolean;
  hasReports: boolean;
  hasMultiChannel: boolean;
  hasApiAccess: boolean;
  hasRoleBasedAccess: boolean;
  supportLevel: string;
  isActive: boolean;
  popular: boolean;
  sortOrder: number;
}

interface SubscriptionData {
  subscription: {
    id: string;
    userId: string;
    planId: string;
    plan: Plan;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  } | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  planId: string | null;
  plan: { name: string } | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
}

interface InvoicesResponse {
  invoices: Invoice[];
  totals: { totalPaid: number; totalInvoices: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrencyUSD(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function daysRemaining(endDate: string | null): number {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

const STATUS_COLORS: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  CANCELED: "danger",
  PAST_DUE: "warning",
  TRIALING: "info",
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "danger",
  REFUNDED: "info",
};

const SUPPORT_LABELS: Record<string, string> = {
  email: "Email Support",
  priority: "Priority Support",
  dedicated: "24/7 Dedicated",
};

function getPlanFeatures(plan: Plan) {
  return [
    {
      label: "Orders",
      value: plan.maxOrders ? `Up to ${plan.maxOrders.toLocaleString()}/month` : "Unlimited",
      included: true,
    },
    {
      label: "Team Members",
      value: plan.maxTeamMembers ? `Up to ${plan.maxTeamMembers}` : "Unlimited",
      included: true,
    },
    { label: "Analytics", included: plan.hasAnalytics },
    { label: "Reports & Insights", included: plan.hasReports },
    { label: "Multi-Channel", included: plan.hasMultiChannel },
    { label: "API Access", included: plan.hasApiAccess },
    { label: "Role-Based Access", included: plan.hasRoleBasedAccess },
    {
      label: "Support",
      value: SUPPORT_LABELS[plan.supportLevel] || plan.supportLevel,
      included: true,
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function BillingPage() {
  const tbilling = useTranslations("billing");
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tbilling("title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tbilling("subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <ZapIcon size={16} className="h-4 w-4" />
            {tbilling("tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {tbilling("tabPlans")}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileTextIcon size={16} className="h-4 w-4" />
            {tbilling("tabInvoices")}
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCardIcon size={16} className="h-4 w-4" />
            {tbilling("tabPayment")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="plans" className="mt-6">
          <PlansTab />
        </TabsContent>
        <TabsContent value="invoices" className="mt-6">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="payment" className="mt-6">
          <PaymentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab() {
  const tbilling = useTranslations("billing");
  const tcommon = useTranslations("common");
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoicesResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, invRes] = await Promise.all([
        fetch("/api/billing/subscription"),
        fetch("/api/billing/invoices?limit=5"),
      ]);
      if (subRes.ok) setSubData(await subRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const confirm = useConfirm();

  const handleCancel = async () => {
    const ok = await confirm({
      description: tbilling("cancelConfirm"),
      confirmLabel: tcommon("confirm"),
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        toast.success(tbilling("canceledToast"));
        fetchData();
      } else {
        toast.error(tbilling("cancelFailed"));
      }
    } catch {
      toast.error(tbilling("cancelFailed"));
    }
  };

  const handleReactivate = async () => {
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      if (res.ok) {
        toast.success(tbilling("reactivatedToast"));
        fetchData();
      } else {
        toast.error(tbilling("reactivateFailed"));
      }
    } catch {
      toast.error(tbilling("reactivateFailed"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const sub = subData?.subscription;
  const daysLeft = sub ? daysRemaining(sub.currentPeriodEnd) : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card
        className={cn(
          "border-2",
          sub?.cancelAtPeriodEnd
            ? "border-amber-200 dark:border-amber-800"
            : sub?.status === "ACTIVE"
              ? "border-emerald-200 dark:border-emerald-800"
              : "border-gray-200 dark:border-gray-800",
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  sub?.cancelAtPeriodEnd
                    ? "bg-amber-50 dark:bg-amber-900/20"
                    : sub
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : "bg-gray-100 dark:bg-gray-800",
                )}
              >
                <ZapIcon
                  size={24}
                  className={cn(
                    "h-6 w-6",
                    sub?.cancelAtPeriodEnd
                      ? "text-amber-600 dark:text-amber-400"
                      : sub
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-400",
                  )}
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{sub ? sub.plan.name : tbilling("noPlan")}</h2>
                  <Badge variant={STATUS_COLORS[sub?.status ?? ""] ?? "outline"}>
                    {sub?.cancelAtPeriodEnd ? tbilling("canceled") : sub?.status || "NONE"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {sub
                    ? `${formatCurrencyUSD(sub.plan.price)}/${sub.plan.interval.toLowerCase()} • ${tbilling("renews")} ${formatDate(sub.currentPeriodEnd)} (${daysLeft} ${tbilling("daysRemaining")})`
                    : tbilling("choosePlan")}
                </p>
                {sub?.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {tbilling("cancelsOn")} {formatDate(sub.currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {sub?.cancelAtPeriodEnd ? (
                <Button variant="outline" onClick={handleReactivate}>
                  <RefreshCwIcon size={16} className="h-4 w-4 mr-2" /> {tbilling("reactivate")}
                </Button>
              ) : sub ? (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <BanIcon size={16} className="h-4 w-4 mr-2" /> {tbilling("cancel")}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage & Stats Grid */}
      {sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                {" "}
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("orders")}</p>
                <p className="text-lg font-bold">
                  {sub.plan.maxOrders
                    ? `${sub.plan.maxOrders.toLocaleString()}${tbilling("perMonth")}`
                    : tbilling("unlimited")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <UsersIcon size={20} className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("teamMembers")}</p>
                <p className="text-lg font-bold">
                  {sub.plan.maxTeamMembers
                    ? `${tbilling("upTo")} ${sub.plan.maxTeamMembers}`
                    : tbilling("unlimited")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("support")}</p>
                <p className="text-lg font-bold capitalize">
                  {SUPPORT_LABELS[sub.plan.supportLevel] || sub.plan.supportLevel}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <ClockIcon size={20} className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("billingCycle")}</p>
                <p className="text-lg font-bold capitalize">{sub.plan.interval.toLowerCase()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{tbilling("recentInvoices")}</CardTitle>
            <CardDescription>{tbilling("lastInvoices")}</CardDescription>
          </div>
          {invoices && invoices.totals.totalInvoices > 0 && (
            <p className="text-sm text-gray-500">
              {tbilling("totalPaid")}: {formatCurrencyUSD(invoices.totals.totalPaid)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {invoices && invoices.invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        inv.status === "PAID"
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : inv.status === "PENDING"
                            ? "bg-amber-50 dark:bg-amber-900/20"
                            : "bg-gray-100 dark:bg-gray-800",
                      )}
                    >
                      <FileTextIcon
                        size={16}
                        className={cn(
                          "h-4 w-4",
                          inv.status === "PAID"
                            ? "text-emerald-600"
                            : inv.status === "PENDING"
                              ? "text-amber-600"
                              : "text-gray-400",
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">
                        {inv.description || inv.plan?.name} • {formatDate(inv.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrencyUSD(inv.amount)}</span>
                    <Badge variant={(STATUS_COLORS[inv.status] as any) || "outline"}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-gray-400">{tbilling("noInvoices")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Plans Tab ──────────────────────────────────────────────────────────────

function PlansTab() {
  const tbilling = useTranslations("billing");
  const tcommon = useTranslations("common");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch("/api/billing/plans"),
        fetch("/api/billing/subscription"),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (subRes.ok) {
        const data = await subRes.json();
        if (data.subscription) setCurrentPlanId(data.subscription.planId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSwitchPlan = async (planId: string) => {
    setSwitching(planId);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (res.ok) {
        toast.success(tbilling("planUpdated"));
        setConfirmPlan(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || tbilling("switchFailed"));
      }
    } catch {
      toast.error(tbilling("switchFailed"));
    } finally {
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Plan Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const features = getPlanFeatures(plan);
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col border-2 transition-all duration-200",
                isCurrent
                  ? "border-indigo-400 dark:border-indigo-600 shadow-lg shadow-indigo-100/50 dark:shadow-indigo-900/20"
                  : plan.popular
                    ? "border-indigo-200 dark:border-indigo-800"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                !isCurrent && "hover:shadow-md hover:-translate-y-1 cursor-pointer",
              )}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold shadow-lg">
                    <ZapIcon size={12} className="h-3 w-3" />
                    {tbilling("mostPopular")}
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-lg">
                    <CheckIcon size={12} className="h-3 w-3" />
                    {tbilling("currentPlan")}
                  </span>
                </div>
              )}

              <CardContent
                className={cn("p-6 flex flex-col flex-1", (plan.popular || isCurrent) && "pt-8")}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCurrencyUSD(plan.price)}</span>
                    <span className="text-sm text-gray-500">/{plan.interval.toLowerCase()}</span>
                  </div>
                  {plan.yearlyPrice && (
                    <p className="text-xs text-gray-400 mt-1">
                      {formatCurrencyUSD(plan.yearlyPrice)}/year (save{" "}
                      {Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100)}%)
                    </p>
                  )}
                </div>

                <Button
                  variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                  className={cn(
                    "w-full mb-6",
                    !isCurrent && plan.popular && "bg-indigo-600 hover:bg-indigo-700",
                  )}
                  disabled={isCurrent || switching === plan.id}
                  onClick={() => setConfirmPlan(plan)}
                >
                  {isCurrent ? (
                    <>{tbilling("currentPlan")}</>
                  ) : switching === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tbilling("switching")}
                    </>
                  ) : (
                    <>
                      <ZapIcon size={16} className="h-4 w-4 mr-2" /> {tbilling("switchPlan")}{" "}
                      {plan.name}
                    </>
                  )}
                </Button>

                <div className="space-y-3 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {tbilling("features")}
                  </p>
                  {features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1">
                        {feat.included !== false ? (
                          <CheckIcon size={16} className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XIcon
                            size={16}
                            className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0"
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-sm",
                          feat.included !== false
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500",
                        )}
                      >
                        {feat.value || feat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={() => setConfirmPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tbilling("switchPlanTitle", { planName: confirmPlan?.name || "" })}
            </DialogTitle>
            <DialogDescription>
              {confirmPlan && currentPlanId
                ? tbilling("switchPlanDesc")
                : tbilling("startPlanDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {confirmPlan && (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="font-medium">{confirmPlan.name} Plan</span>
                  <span className="font-bold text-lg">
                    {formatCurrencyUSD(confirmPlan.price)}/{confirmPlan.interval.toLowerCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-y-2">
                  <div className="flex items-center gap-2">
                    <CircleCheckIcon size={16} className="h-4 w-4 text-emerald-500" />
                    <span>
                      {tbilling("billed")} {confirmPlan.interval.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CircleCheckIcon size={16} className="h-4 w-4 text-emerald-500" />
                    <span>{tbilling("cancelAnytime")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CircleCheckIcon size={16} className="h-4 w-4 text-emerald-500" />
                    <span>{tbilling("noHiddenFees")}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPlan(null)}>
              {tcommon("cancel")}
            </Button>
            <Button
              onClick={() => confirmPlan && handleSwitchPlan(confirmPlan.id)}
              disabled={switching === confirmPlan?.id}
            >
              {switching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tbilling("processing")}
                </>
              ) : (
                <>
                  <ZapIcon size={16} className="h-4 w-4 mr-2" /> {tbilling("confirmChange")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────

function InvoicesTab() {
  const tbilling = useTranslations("billing");
  const tcommon = useTranslations("common");
  const [invoicesData, setInvoicesData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/invoices?limit=100");
      if (res.ok) setInvoicesData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInvoices();
  }, [fetchInvoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const invoices = invoicesData?.invoices || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      {invoicesData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <FileTextIcon
                  size={20}
                  className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("totalInvoices")}</p>
                <p className="text-xl font-bold">{invoicesData.totals.totalInvoices}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <CreditCardIcon size={20} className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("totalPaid")}</p>
                <p className="text-xl font-bold">
                  {formatCurrencyUSD(invoicesData.totals.totalPaid)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <ClockIcon size={20} className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{tbilling("pending")}</p>
                <p className="text-xl font-bold">
                  {invoices.filter((i) => i.status === "PENDING").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>{tbilling("invoiceHistory")}</CardTitle>
          <CardDescription>{tbilling("allInvoices")}</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileTextIcon size={48} className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{tbilling("noInvoices")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">
                      {tbilling("invoiceCol")}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">
                      {tbilling("periodCol")}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">
                      {tbilling("amountCol")}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">
                      {tbilling("statusCol")}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">
                      {tbilling("paymentCol")}
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">
                      {tbilling("dateCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <>
                      <tr
                        key={inv.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)
                        }
                      >
                        <td className="py-3 px-2">
                          <div>
                            <span className="font-medium">{inv.invoiceNumber}</span>
                            {inv.description && (
                              <p className="text-xs text-gray-500">{inv.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                          {inv.periodStart && inv.periodEnd
                            ? `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-2 font-medium">{formatCurrencyUSD(inv.amount)}</td>
                        <td className="py-3 px-2">
                          <Badge variant={(STATUS_COLORS[inv.status] as any) || "outline"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-gray-500 text-xs">
                          {inv.paymentMethod ? inv.paymentMethod.replace("_", " ") : "—"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500 text-xs">
                          {formatDate(inv.createdAt)}
                        </td>
                      </tr>
                      {expandedInvoice === inv.id && (
                        <tr className="bg-gray-50 dark:bg-gray-800/30">
                          <td colSpan={6} className="p-4">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-500">
                                Status: <strong>{inv.status}</strong>
                              </span>
                              {inv.paidAt && (
                                <span className="text-gray-500">
                                  Paid: <strong>{formatDate(inv.paidAt)}</strong>
                                </span>
                              )}
                              {inv.paymentMethod && (
                                <span className="text-gray-500">
                                  Method:{" "}
                                  <strong className="capitalize">
                                    {inv.paymentMethod.replace("_", " ")}
                                  </strong>
                                </span>
                              )}
                              {inv.plan?.name && (
                                <span className="text-gray-500">
                                  Plan: <strong>{inv.plan.name}</strong>
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-auto"
                                onClick={() =>
                                  window.open(`/api/billing/invoices/${inv.id}/download`, "_blank")
                                }
                              >
                                <DownloadIcon size={16} className="h-4 w-4 mr-1" />{" "}
                                {tbilling("pdf")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payment Tab ─────────────────────────────────────────────────────────────

function PaymentTab() {
  const tbilling = useTranslations("billing");
  const tcommon = useTranslations("common");
  return (
    <div className="space-y-6">
      {/* Saved Cards */}
      <Card>
        <CardHeader>
          <CardTitle>{tbilling("paymentMethods")}</CardTitle>
          <CardDescription>{tbilling("paymentMethodsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <CreditCardIcon size={48} className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
              {tbilling("noPaymentMethods")}
            </h3>
            <p className="text-sm text-gray-400 mb-4">{tbilling("paymentComingSoon")}</p>
            <Button disabled>
              <CreditCardIcon size={16} className="h-4 w-4 mr-2" /> {tbilling("addPaymentMethod")}
            </Button>
            <p className="text-xs text-gray-400 mt-3">{tbilling("paymentComingSoon")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card>
        <CardHeader>
          <CardTitle>{tbilling("billingInfo")}</CardTitle>
          <CardDescription>{tbilling("billingInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <CircleHelpIcon size={48} className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-sm text-gray-400">{tbilling("billingInfoPlaceholder")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
