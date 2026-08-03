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
import { toast } from "sonner";
import { ClockIcon, UsersIcon, DollarSignIcon } from "lucide-animated";
import { ShoppingCart, Package, AlertTriangle, Megaphone, Gift, BellRing } from "lucide-react";

export type NotificationType =
  | "order"
  | "customer"
  | "product"
  | "revenue"
  | "inventory"
  | "discount"
  | "campaign"
  | "milestone"
  | "alert";

export interface RealtimeNotification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  timestamp: Date;
  read?: boolean;
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
  budgetThreshold: 80,
  setBudgetThreshold: () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

const MAX_NOTIFICATIONS = 50;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("connecting");
  const [budgetThreshold, setBudgetThresholdState] = useState<number>(80);

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

  const addNotification = useCallback((notification: RealtimeNotification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
    showToast(notification);
  }, []);

  // Connect to SSE endpoint for real-time updates
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;

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
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastGlobalUpdate(new Date(data.timestamp));

            // Check if data actually changed (skip on initial connect)
            if (data.changed) {
              detectAllChanges(data);
            }

            // Store current state for next comparison
            previousStatsRef.current = JSON.stringify(data.stats || {});
            previousAlertsRef.current = JSON.stringify(data.alerts || {});
            previousDiscountsRef.current = JSON.stringify(data.expiringDiscounts || []);
            previousProductsRef.current = `${data.newProductsCount || 0}`;
            previousCampaignsRef.current = JSON.stringify(data.budgetAlerts || {});

            // Signal pages to refresh
            setGlobalRefreshTrigger((prev) => prev + 1);
          } catch (e) {
            // Parse errors silently handled
          }
        };

        es.onerror = () => {
          setConnectionStatus("disconnected");
          es.close();
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectAttempts++;
          reconnectTimeout = setTimeout(connect, delay);
        };
      } catch (e) {
        setConnectionStatus("disconnected");
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearTimeout(reconnectTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectAllChanges = useCallback(
    (data: any) => {
      const now = new Date();

      // --- Detect new orders ---
      if (data.stats) {
        const prevStats = tryParse(previousStatsRef.current);
        const newOrders = (data.stats.totalOrders || 0) - (prevStats?.totalOrders || 0);
        if (newOrders > 0) {
          const orderNotif: RealtimeNotification = {
            id: `order-${now.getTime()}`,
            title: `${newOrders} New Order${newOrders > 1 ? "s" : ""}`,
            description: `$${(data.stats.totalRevenue || 0).toLocaleString()} total revenue`,
            type: "order",
            timestamp: now,
          };
          addNotification(orderNotif);
        }

        // --- Revenue milestone ---
        if (data.today?.nearestRevenueMilestone && prevStats) {
          const prevRevenue = prevStats?.totalRevenue || 0;
          const currentRevenue = data.stats.totalRevenue || 0;
          const milestones = [1000000, 5000000, 10000000, 50000000, 100000000];
          const prevMilestone = milestones.filter((m) => prevRevenue >= m).length;
          const currMilestone = milestones.filter((m) => currentRevenue >= m).length;
          if (currMilestone > prevMilestone) {
            addNotification({
              id: `milestone-${now.getTime()}`,
              title: "🎉 Revenue Milestone Reached!",
              description: `$${currentRevenue.toLocaleString()} total revenue`,
              type: "milestone",
              timestamp: now,
            });
          }
        }

        // --- New customers ---
        const newCustomers = (data.stats.totalCustomers || 0) - (prevStats?.totalCustomers || 0);
        if (newCustomers > 0) {
          addNotification({
            id: `customer-${now.getTime()}`,
            title: `${newCustomers} New Customer${newCustomers > 1 ? "s" : ""}`,
            description: `Total: ${data.stats.totalCustomers} customers`,
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
          addNotification({
            id: `inventory-${now.getTime()}`,
            title: `⚠️ ${currentLowStock} Low Stock Items`,
            description: lowStockItems || `${currentLowStock} products need restocking`,
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
          addNotification({
            id: `discount-${now.getTime()}`,
            title: `${data.expiringDiscounts.length} Discount${data.expiringDiscounts.length > 1 ? "s" : ""} Expiring Soon`,
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
          addNotification({
            id: `product-${now.getTime()}`,
            title: `${data.newProductsCount - prevCount} New Product${data.newProductsCount - prevCount > 1 ? "s" : ""} Added`,
            description: `${data.stats.totalProducts} total products in catalog`,
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
            addNotification({
              id: `budget-over-${now.getTime()}-${campaign.id}`,
              title: `🚨 Budget Exhausted: ${campaign.name}`,
              description: `Spent ${formatBudgetShort(campaign.spent)} of ${formatBudgetShort(campaign.budget)} budget`,
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
            addNotification({
              id: `budget-near-${now.getTime()}-${campaign.id}`,
              title: `⚠️ Budget ${campaign.percentUsed}% Used: ${campaign.name}`,
              description: `$${campaign.spent.toLocaleString()} of $${campaign.budget.toLocaleString()} spent`,
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
          addNotification({
            id: `alert-${now.getTime()}`,
            title: `🔔 ${data.alerts.pendingOrders} Pending Orders`,
            description: "Orders awaiting processing attention",
            type: "alert",
            timestamp: now,
          });
        }
      }
    },
    [addNotification, budgetThreshold],
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
        budgetThreshold,
        setBudgetThreshold,
      }}
    >
      {children}
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

function showToast(notification: RealtimeNotification) {
  const iconMap: Record<NotificationType, React.ElementType> = {
    order: ShoppingCart,
    customer: UsersIcon,
    product: Package,
    revenue: DollarSignIcon,
    inventory: AlertTriangle,
    discount: ClockIcon,
    campaign: Megaphone,
    milestone: Gift,
    alert: BellRing,
  };
  const Icon = iconMap[notification.type];

  toast(notification.title, {
    description: notification.description,
    icon: <Icon size={16} className="h-4 w-4" />,
    duration: 4000,
  });
}
