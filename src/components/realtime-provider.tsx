"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { ClockIcon, UsersIcon, DollarSignIcon } from "lucide-animated";
import { Package, AlertTriangle, Megaphone, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { RealtimeToasts, useToastStack, type FloatingToast } from "@/components/realtime-toasts";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

export type NotificationType =
  | "order"
  | "customer"
  | "product"
  | "revenue"
  | "inventory"
  | "discount"
  | "campaign"
  | "milestone"
  | "billing"
  | "alert";

export interface RealtimeNotification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  timestamp: Date;
  read?: boolean;
  /** True when the event was reconstructed from a replayed SSE snapshot,
   * i.e. it happened BEFORE this tab connected. Rendered without toast and
   * flagged in the activity feed. */
  replayed?: boolean;
}

interface RealtimeContextType {
  lastGlobalUpdate: Date | null;
  notifications: RealtimeNotification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
  addNotification: (notification: RealtimeNotification) => void;
  globalRefreshTrigger: number;
  triggerRefresh: () => void;
  connectionStatus: "connected" | "disconnected" | "connecting";
  /** Reconnect backoff details while the stream is down (for the health badge tooltip). */
  reconnectInfo: { attempt: number; retryAt: number | null };
  budgetThreshold: number;
  setBudgetThreshold: (threshold: number) => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  lastGlobalUpdate: null,
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  clearNotifications: () => {},
  addNotification: () => {},
  globalRefreshTrigger: 0,
  triggerRefresh: () => {},
  connectionStatus: "connecting",
  reconnectInfo: { attempt: 0, retryAt: null },
  budgetThreshold: 80,
  setBudgetThreshold: () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

const MAX_NOTIFICATIONS = 50;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const tDashboard = useTranslations("dashboard");
  const locale = useLocale();
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("connecting");
  const [budgetThreshold, setBudgetThresholdState] = useState<number>(80);
  const [reconnectInfo, setReconnectInfo] = useState<{
    attempt: number;
    retryAt: number | null;
  }>({ attempt: 0, retryAt: null });

  // Boardui-style floating toast stack (bottom-right viewport surface).
  const { toasts, push: pushToast, dismiss: dismissToast } = useToastStack();

  // Every toast lives in the bell feed too (the toast ID equals the feed
  // entry ID). The two dismissal paths carry different semantics:
  //   • auto-dismiss (6s expiry) keeps the feed entry UNREAD — the owner
  //     "missed" the toast, so the bell surfaces it with a dot;
  //   • explicit dismiss (X / Dismiss button) marks it READ — acknowledged.
  // Either way the event is never lost after the toast window closes.
  const handleToastDismiss = useCallback(
    (id: string) => {
      dismissToast(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    [dismissToast],
  );

  // Hydration-safe: read persisted threshold from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("budget-threshold");
      if (saved) {
        setBudgetThresholdState(parseInt(saved));
      }
    } catch {
      // localStorage may be blocked
    }
  }, []);

  const setBudgetThreshold = useCallback((threshold: number) => {
    setBudgetThresholdState(threshold);
    try {
      localStorage.setItem("budget-threshold", threshold.toString());
    } catch {
      // localStorage may be blocked
    }
  }, []);
  const previousStatsRef = useRef<string>("");
  const previousAlertsRef = useRef<string>("");
  const previousDiscountsRef = useRef<string>("");
  const previousProductsRef = useRef<string>("");
  const previousCampaignsRef = useRef<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const triggerRefresh = useCallback(() => {
    setGlobalRefreshTrigger((prev) => prev + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback(
    (notification: RealtimeNotification, options?: { silent?: boolean }) => {
      setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
      // Replayed events predate the tab — never toast them.
      if (!options?.silent && !notification.replayed) {
        pushToast({
          id: notification.id,
          title: notification.title,
          description: notification.description,
          type: notification.type,
          createdAt:
            notification.timestamp instanceof Date ? notification.timestamp.getTime() : Date.now(),
          action:
            notification.type === "order"
              ? { label: tDashboard("viewOrders"), href: `/${locale}/orders` }
              : notification.type === "inventory"
                ? { label: tDashboard("restock"), href: `/${locale}/inventory` }
                : undefined,
          presence: notification.type === "customer" ? "online" : undefined,
        });
      }
    },
    [],
  );

  // Connect to the SSE endpoint for real-time updates. /api/realtime requires
  // an authenticated session (it returns 401 otherwise), so the connection is
  // gated on the auth state: booting logged-out stays quiet (no 401 retry
  // storm), and signing in connects IMMEDIATELY with a fresh backoff instead of
  // waiting out the old exponential retry schedule (which could otherwise leave
  // the indicator stuck on Disconnected for up to 30s after login). Logging out
  // closes the stream right away.
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;

    const cleanup = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      clearTimeout(reconnectTimeout);
    };

    if (!isAuthenticated) {
      // Deferred status reset on logout / logged-out boot. The setState is
      // intentional (the indicator must leave "Connected" when the session
      // ends) and matches the repo's existing pattern for this rule.
      setConnectionStatus("disconnected"); // eslint-disable-line react-hooks/set-state-in-effect
      setReconnectInfo({ attempt: 0, retryAt: null });
      return cleanup;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnectionStatus("connecting");

      try {
        const es = new EventSource("/api/realtime");
        eventSourceRef.current = es;

        es.onopen = () => {
          setConnectionStatus("connected");
          reconnectAttempts = 0;
          setReconnectInfo({ attempt: 0, retryAt: null });
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastGlobalUpdate(new Date(data.timestamp));

            // Check if data actually changed (skip on initial connect).
            // Replayed snapshots predate this tab, so detected events are
            // tagged and stay silent (no toast) but still populate the feed.
            const isReplay = data.replayed === true;
            if (data.changed) {
              detectAllChanges(data, isReplay);
            }

            // Store current state for next comparison
            previousStatsRef.current = JSON.stringify(data.stats || {});
            previousAlertsRef.current = JSON.stringify(data.alerts || {});
            previousDiscountsRef.current = JSON.stringify(data.expiringDiscounts || []);
            previousProductsRef.current = `${data.newProductsCount || 0}`;
            previousCampaignsRef.current = JSON.stringify(data.budgetAlerts || {});

            // Signal pages to refresh
            setGlobalRefreshTrigger((prev) => prev + 1);
          } catch (_e) {
            void _e;
          }
        };

        es.onerror = () => {
          setConnectionStatus("disconnected");
          es.close();
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectAttempts++;
          const retryAt = Date.now() + delay;
          setReconnectInfo({ attempt: reconnectAttempts, retryAt });
          reconnectTimeout = setTimeout(connect, delay);
        };
      } catch (_e) {
        void _e;
        setConnectionStatus("disconnected");
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        setReconnectInfo({ attempt: reconnectAttempts, retryAt: Date.now() + delay });
        reconnectTimeout = setTimeout(connect, delay);
      }
    };

    connect();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const detectAllChanges = useCallback(
    (data: any, silent: boolean = false) => {
      // Local push that tags events detected from a replayed snapshot so the
      // feed can mark them as predating this tab (and skip the toast).
      // (Was self-recursive — every detected change blew the call stack.)
      const push = (n: RealtimeNotification): void =>
        addNotification({ ...n, replayed: silent ? true : undefined });

      const now = new Date();

      // --- Detect new orders ---
      if (data.stats) {
        const prevStats = tryParse(previousStatsRef.current);
        const newOrders = (data.stats.totalOrders || 0) - (prevStats?.totalOrders || 0);
        if (newOrders > 0) {
          const orderNotif: RealtimeNotification = {
            id: `order-${now.getTime()}`,
            title: tDashboard("newOrderTitle", { count: newOrders }),
            description: tDashboard("orderRevenue", {
              revenue: (data.stats.totalRevenue || 0).toLocaleString(),
            }),
            type: "order",
            timestamp: now,
          };
          push(orderNotif);
        }

        // --- Revenue milestone ---
        if (data.today?.nearestRevenueMilestone && prevStats) {
          const prevRevenue = prevStats?.totalRevenue || 0;
          const currentRevenue = data.stats.totalRevenue || 0;
          const milestones = [1000000, 5000000, 10000000, 50000000, 100000000];
          const prevMilestone = milestones.filter((m) => prevRevenue >= m).length;
          const currMilestone = milestones.filter((m) => currentRevenue >= m).length;
          if (currMilestone > prevMilestone) {
            push({
              id: `milestone-${now.getTime()}`,
              title: tDashboard("milestoneTitle"),
              description: tDashboard("orderRevenue", {
                revenue: currentRevenue.toLocaleString(),
              }),
              type: "milestone",
              timestamp: now,
            });
          }
        }

        // --- New customers ---
        const newCustomers = (data.stats.totalCustomers || 0) - (prevStats?.totalCustomers || 0);
        if (newCustomers > 0) {
          push({
            id: `customer-${now.getTime()}`,
            title: tDashboard("newCustomerTitle", { count: newCustomers }),
            description: tDashboard("customerTotal", { count: data.stats.totalCustomers }),
            type: "customer",
            timestamp: now,
          });
        }
      }

      // --- Low stock alerts ---
      if (data.lowStockProductsList?.length > 0) {
        const prevAlerts = tryParse(previousAlertsRef.current);
        const prevLowStock = prevAlerts?.lowStockProducts || 0;
        const currentLowStock = data.alerts?.lowStockProducts || 0;

        if (currentLowStock > prevLowStock) {
          const lowStockItems = data.lowStockProductsList
            .slice(0, 2)
            .map((p: any) => `${p.name} (${p.stock} left)`)
            .join(", ");
          push({
            id: `inventory-${now.getTime()}`,
            title: tDashboard("lowStockTitle", { count: currentLowStock }),
            description:
              lowStockItems || tDashboard("productsNeedRestock", { count: currentLowStock }),
            type: "inventory",
            timestamp: now,
          });
        }
      }

      // --- Expiring discounts ---
      if (data.expiringDiscounts?.length > 0) {
        const prevDiscounts = tryParse(previousDiscountsRef.current);
        const prevDiscountStr = JSON.stringify(prevDiscounts);
        const currDiscountStr = JSON.stringify(data.expiringDiscounts);
        if (prevDiscountStr !== currDiscountStr && prevDiscountStr !== "null") {
          push({
            id: `discount-${now.getTime()}`,
            title: tDashboard("discountsExpiringTitle", {
              count: data.expiringDiscounts.length,
            }),
            description: data.expiringDiscounts.map((d: any) => `${d.code}`).join(", "),
            type: "discount",
            timestamp: now,
          });
        }
      }

      // --- New products ---
      if (data.newProductsCount > 0) {
        const prevCount = parseInt(previousProductsRef.current || "0");
        if (prevCount > 0 && data.newProductsCount > prevCount) {
          push({
            id: `product-${now.getTime()}`,
            title: tDashboard("newProductTitle", {
              count: data.newProductsCount - prevCount,
            }),
            description: tDashboard("catalogTotal", { count: data.stats.totalProducts }),
            type: "product",
            timestamp: now,
          });
        }
      }

      // --- Campaign budget alerts (using user-defined threshold) ---
      if (data.budgetAlerts) {
        const prevCampaigns = tryParse(previousCampaignsRef.current);
        const thresholdDecimal = budgetThreshold / 100;
        const allCampaigns = data.budgetAlerts.allCampaigns || [];
        const prevAllCampaigns = prevCampaigns?.allCampaigns || [];

        // Compute over-budget and near-threshold on the client side
        const currOverBudget = allCampaigns.filter((c: any) => c.spent >= c.budget);
        const currNearBudget = allCampaigns.filter(
          (c: any) => c.spent >= c.budget * thresholdDecimal && c.spent < c.budget,
        );
        const prevOverBudget = prevAllCampaigns.filter((c: any) => c.spent >= c.budget);
        const prevNearBudget = prevAllCampaigns.filter(
          (c: any) => prevCampaigns && c.spent >= c.budget * 0.8 && c.spent < c.budget,
        );

        const prevOverStr = JSON.stringify(prevOverBudget.map((c: any) => c.id));
        const currOverStr = JSON.stringify(currOverBudget.map((c: any) => c.id));
        const prevNearStr = JSON.stringify(prevNearBudget.map((c: any) => c.id));
        const currNearStr = JSON.stringify(currNearBudget.map((c: any) => c.id));

        // Detect new over-budget campaigns
        if (currOverStr !== prevOverStr) {
          const newOverBudget = currOverBudget.filter(
            (c: any) => !prevOverBudget.find((p: any) => p.id === c.id),
          );
          for (const campaign of newOverBudget) {
            push({
              id: `budget-over-${now.getTime()}-${campaign.id}`,
              title: tDashboard("budgetExhaustedTitle", { name: campaign.name }),
              description: tDashboard("budgetSpentOf", {
                spent: formatBudgetShort(campaign.spent),
                budget: formatBudgetShort(campaign.budget),
              }),
              type: "campaign",
              timestamp: now,
            });
          }
        }

        // Detect campaigns newly crossing user-defined budget threshold
        if (currNearStr !== prevNearStr) {
          const newNearBudget = currNearBudget.filter(
            (c: any) => !prevNearBudget.find((p: any) => p.id === c.id),
          );
          for (const campaign of newNearBudget) {
            push({
              id: `budget-near-${now.getTime()}-${campaign.id}`,
              title: tDashboard("budgetNearTitle", {
                percent: campaign.percentUsed,
                name: campaign.name,
              }),
              description: tDashboard("budgetSpentOf", {
                spent: campaign.spent.toLocaleString(),
                budget: campaign.budget.toLocaleString(),
              }),
              type: "campaign",
              timestamp: now,
            });
          }
        }
      }

      // --- Pending orders alert ---
      if (data.alerts?.pendingOrders > 5) {
        const prevAlerts = tryParse(previousAlertsRef.current);
        if (prevAlerts?.pendingOrders && data.alerts.pendingOrders > prevAlerts.pendingOrders) {
          push({
            id: `alert-${now.getTime()}`,
            title: tDashboard("pendingOrdersTitle", { count: data.alerts.pendingOrders }),
            description: tDashboard("pendingOrdersDesc"),
            type: "alert",
            timestamp: now,
          });
        }
      }
    },
    [budgetThreshold],
  );

  return (
    <RealtimeContext.Provider
      value={{
        lastGlobalUpdate,
        notifications,
        unreadCount,
        markAllRead,
        clearNotifications,
        addNotification,
        globalRefreshTrigger,
        triggerRefresh,
        connectionStatus,
        reconnectInfo,
        budgetThreshold,
        setBudgetThreshold,
      }}
    >
      {children}
      {/* Boardui-style floating toast surface for live SSE events. */}
      <RealtimeToasts toasts={toasts} onDismiss={handleToastDismiss} />
    </RealtimeContext.Provider>
  );
}

function tryParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatBudgetShort(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}
