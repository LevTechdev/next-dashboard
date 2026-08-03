"use client";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { CheckIcon, ClockIcon, TruckIcon } from "lucide-animated";
import { PackageCheck, XCircle } from "lucide-react";

interface TrackingEvent {
  status: string;
  timestamp: Date | string;
  note?: string;
}

interface OrderTrackingTimelineProps {
  currentStatus: string;
  events?: TrackingEvent[];
  className?: string;
}

const STATUS_FLOW = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING: {
    label: "Order Placed",
    icon: ClockIcon,
    color: "text-yellow-600 dark:text-yellow-400",
  },
  PROCESSING: {
    label: "Processing",
    icon: PackageCheck,
    color: "text-blue-600 dark:text-blue-400",
  },
  SHIPPED: { label: "Shipped", icon: TruckIcon, color: "text-purple-600 dark:text-purple-400" },
  DELIVERED: { label: "Delivered", icon: CheckIcon, color: "text-green-600 dark:text-green-400" },
  CANCELLED: { label: "Cancelled", icon: XCircle, color: "text-red-600 dark:text-red-400" },
};

export function OrderTrackingTimeline({
  currentStatus,
  events = [],
  className,
}: OrderTrackingTimelineProps) {
  const isCancelled = currentStatus === "CANCELLED";
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Bar */}
      {!isCancelled && (
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            {STATUS_FLOW.map((status, i) => {
              const config = STATUS_CONFIG[status];
              const isCompleted = i <= currentIndex;
              const isCurrent = i === currentIndex;
              const Icon = config.icon;
              return (
                <div key={status} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500",
                      isCompleted
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400",
                      isCurrent &&
                        "ring-2 ring-indigo-500/30 ring-offset-2 dark:ring-offset-gray-900",
                    )}
                  >
                    <Icon size={16} className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-1.5 whitespace-nowrap",
                      isCompleted
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                  >
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Connecting Lines */}
          <div className="absolute top-4 left-[4.5%] right-[4.5%] -translate-y-1/2 flex">
            {STATUS_FLOW.slice(0, -1).map((_, i) => {
              const isCompleted = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 h-0.5 transition-all duration-500",
                    isCompleted
                      ? "bg-indigo-500"
                      : isCurrent
                        ? "bg-gradient-to-r from-indigo-500 to-gray-300 dark:to-gray-600"
                        : "bg-gray-200 dark:bg-gray-700",
                  )}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled Badge */}
      {isCancelled && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Order Cancelled</p>
            <p className="text-xs text-red-500 dark:text-red-400">
              This order has been cancelled and will not be processed further.
            </p>
          </div>
        </div>
      )}

      {/* Status Events Timeline */}
      {events.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Status History
          </p>
          <div className="space-y-0">
            {events.map((event, i) => {
              const config = STATUS_CONFIG[event.status];
              const Icon = config?.icon || ClockIcon;
              const isLast = i === events.length - 1;
              return (
                <div key={i} className="flex gap-3 relative pb-4 last:pb-0">
                  {/* Timeline Line */}
                  {!isLast && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                  )}
                  {/* Dot */}
                  <div className="relative z-10 mt-1">
                    <div
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full",
                        isLast
                          ? "bg-indigo-100 dark:bg-indigo-900/30"
                          : "bg-gray-100 dark:bg-gray-800",
                      )}
                    >
                      <Icon
                        size={12}
                        className={cn(
                          "h-3 w-3",
                          isLast ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400",
                        )}
                      />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {config?.label || event.status}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(event.timestamp)}
                    </p>
                    {event.note && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {event.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function getTrackingEventsFromOrder(order: any): TrackingEvent[] {
  const events: TrackingEvent[] = [];

  // Build events from order created date and status changes
  if (order.createdAt) {
    events.push({
      status: "PENDING",
      timestamp: order.createdAt,
      note: order.notes || undefined,
    });
  }

  // If order has progressed past PENDING, add processing event
  const statusFlow = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
  const currentIdx = statusFlow.indexOf(order.status);

  if (currentIdx >= 1) {
    // Approximate timestamps based on order updatedAt
    const createdDate = new Date(order.createdAt);
    const updatedDate = new Date(order.updatedAt);
    const duration = updatedDate.getTime() - createdDate.getTime();

    for (let i = 1; i <= currentIdx; i++) {
      const progress = i / statusFlow.length;
      const eventDate = new Date(createdDate.getTime() + duration * progress);
      events.push({
        status: statusFlow[i],
        timestamp: eventDate,
      });
    }
  }

  // Also check if there's an updatedAt that's different from created and status isn't just PENDING
  if (order.status === "PENDING" && order.updatedAt && order.updatedAt !== order.createdAt) {
    events.push({
      status: "PROCESSING",
      timestamp: order.updatedAt,
    });
  }

  return events;
}
