"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Truck,
  Plane,
  Bike,
  Zap,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Leaf,
  Navigation,
  Sparkles,
  Search,
  RotateCw,
  Send,
  Building,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FleetShipment,
  FleetTelemetrySummary,
  MOCK_FLEET_SHIPMENTS,
  getFleetTelemetrySummary,
  TransportModality,
  DeliveryStatus,
} from "@/lib/logistics-fleet";

export function LogisticsFleetTracker() {
  const t = useTranslations("logisticsFleet");

  const [shipments, setShipments] = useState<FleetShipment[]>(MOCK_FLEET_SHIPMENTS);
  const [summary, setSummary] = useState<FleetTelemetrySummary>(() =>
    getFleetTelemetrySummary(MOCK_FLEET_SHIPMENTS),
  );
  const [activeTab, setActiveTab] = useState<"all" | "exceptions">("all");
  const [search, setSearch] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<FleetShipment | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory/logistics/shipments")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setShipments(data.shipments || MOCK_FLEET_SHIPMENTS);
          setSummary(data.summary || getFleetTelemetrySummary(MOCK_FLEET_SHIPMENTS));
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(tracking);
    setTimeout(() => setCopiedTracking(null), 2000);
    toast.success("Tracking number copied to clipboard");
  };

  const handleResolveException = async (shipmentId: string, action: string) => {
    setActionLoading(shipmentId + "-" + action);
    try {
      const res = await fetch("/api/inventory/logistics/resolve-exception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, action }),
      });
      if (res.ok) {
        toast.success(t("actionDispatched"), {
          description: `Action ${action} successfully registered with carrier hub.`,
        });
        // Optimistically update status
        setShipments((prev) =>
          prev.map((s) =>
            s.id === shipmentId ? { ...s, status: "IN_TRANSIT" as DeliveryStatus } : s,
          ),
        );
        if (selectedShipment?.id === shipmentId) {
          setSelectedShipment((prev) =>
            prev ? { ...prev, status: "IN_TRANSIT" as DeliveryStatus } : null,
          );
        }
      }
    } catch {
      toast.error("Failed to dispatch exception resolution");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredShipments = shipments.filter((s) => {
    const matchesTab = activeTab === "all" || s.status === "EXCEPTION";
    const matchesSearch =
      s.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      s.carrier.toLowerCase().includes(search.toLowerCase()) ||
      s.destinationCity.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getModalityIcon = (mod: TransportModality) => {
    switch (mod) {
      case "AIR_FREIGHT":
        return <Plane className="h-3.5 w-3.5 text-sky-500" />;
      case "EV_FLEET":
        return <Zap className="h-3.5 w-3.5 text-emerald-500" />;
      case "SCOOTER_COURIER":
        return <Bike className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Truck className="h-3.5 w-3.5 text-indigo-500" />;
    }
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case "DELIVERED":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-mono font-bold">
            <CheckCircle2 className="h-3 w-3 mr-1 inline" />
            DELIVERED
          </Badge>
        );
      case "OUT_FOR_DELIVERY":
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700 text-[10px] font-mono font-bold">
            <Navigation className="h-3 w-3 mr-1 inline animate-spin [animation-duration:4s]" />
            OUT FOR DELIVERY
          </Badge>
        );
      case "EXCEPTION":
        return (
          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-[10px] font-mono font-bold">
            <AlertTriangle className="h-3 w-3 mr-1 inline" />
            EXCEPTION
          </Badge>
        );
      default:
        return (
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-700 text-[10px] font-mono font-bold">
            <Truck className="h-3 w-3 mr-1 inline" />
            IN TRANSIT
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Telemetry Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("activeShipments")}
              </span>
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 font-mono">
              {summary.activeShipmentsCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary.inTransitCount} in transit • {summary.outForDeliveryCount} out for delivery
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("deliveredToday")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
              {summary.deliveredTodayCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Avg turnaround: {summary.avgDeliveryHours} hours
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("deliveryExceptions")}
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2 font-mono">
              {summary.exceptionsCount}
            </div>
            <p className="text-[11px] text-rose-500 mt-1">Requires immediate merchant action</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {t("fleetScore")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Leaf className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 font-mono flex items-center gap-1.5">
              <span>{summary.fleetEfficiencyScore}/100</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold font-sans">
                ECO-A
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              {summary.totalCo2SavedKg.toLocaleString()}kg CO2 offset
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Fleet Shipments Table & Controls ─── */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-500" />
                {t("title")}
              </CardTitle>
              <CardDescription className="text-xs">{t("subtitle")}</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1",
                    activeTab === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  <span>{t("tabAllShipments")}</span>
                  <span className="text-[10px] px-1 rounded-full bg-slate-200 dark:bg-slate-700">
                    {shipments.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("exceptions")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1",
                    activeTab === "exceptions"
                      ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-rose-600",
                  )}
                >
                  <span>{t("tabExceptionsOnly")}</span>
                  {summary.exceptionsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                      {summary.exceptionsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Search */}
              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search tracking, city, order..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/60 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 text-left font-medium">{t("trackingCol")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("carrierCol")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("statusCol")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("progressCol")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("modalityCol")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("etaCol")}</th>
                  <th className="py-2.5 px-3 text-right font-medium">{t("actionCol")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredShipments.map((shp) => {
                  const isCopied = copiedTracking === shp.trackingNumber;

                  return (
                    <tr
                      key={shp.id}
                      className={cn(
                        "hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors",
                        shp.status === "EXCEPTION" && "bg-rose-50/20 dark:bg-rose-950/10",
                      )}
                    >
                      {/* Tracking / Order */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                          <span>{shp.trackingNumber}</span>
                          <button
                            onClick={() => handleCopyTracking(shp.trackingNumber)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Copy AWB"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {shp.orderNumber} • {shp.recipientName}
                        </div>
                      </td>

                      {/* Carrier & Destination */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {shp.carrier}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {shp.destinationCity}, {shp.destinationCountry} ({shp.distanceKm} km)
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">{getStatusBadge(shp.status)}</td>

                      {/* Progress Bar */}
                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-600 dark:text-slate-400">
                          <span>Progress</span>
                          <span>{shp.progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              shp.status === "EXCEPTION"
                                ? "bg-rose-500"
                                : shp.status === "DELIVERED"
                                  ? "bg-emerald-500"
                                  : "bg-sky-500",
                            )}
                            style={{ width: `${shp.progressPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Modality & CO2 */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {getModalityIcon(shp.modality)}
                          <span className="capitalize">
                            {shp.modality.toLowerCase().replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                          {shp.co2Grams === 0
                            ? "Zero CO2"
                            : `${(shp.co2Grams / 1000).toFixed(1)} kg CO2`}
                          {shp.isCarbonNeutral && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ● {t("carbonNeutralBadge")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estimated Delivery */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {new Date(shp.estimatedDelivery).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedShipment(shp)}
                            className="h-7 text-xs border-indigo-400/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            {t("inspectRoute")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Multimodal Route & Waypoint Telemetry Modal ─── */}
      <Dialog
        open={Boolean(selectedShipment)}
        onOpenChange={(open) => !open && setSelectedShipment(null)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-500" />
                <div>
                  <DialogTitle className="text-base font-bold">{t("routeModalTitle")}</DialogTitle>
                  <DialogDescription className="text-xs">{t("routeModalDesc")}</DialogDescription>
                </div>
              </div>
              {selectedShipment && getStatusBadge(selectedShipment.status)}
            </div>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Top Overview Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-border/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    CARRIER AIRWAY BILL
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {selectedShipment.trackingNumber}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {selectedShipment.carrier} • Dest: {selectedShipment.destinationCity},{" "}
                    {selectedShipment.destinationCountry}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-mono block">
                    MODALITY & EMISSIONS
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {selectedShipment.isCarbonNeutral
                      ? "100% Offset"
                      : `${(selectedShipment.co2Grams / 1000).toFixed(1)}kg CO2`}
                  </span>
                </div>
              </div>

              {/* Delivery Exception Alert Banner if applicable */}
              {selectedShipment.status === "EXCEPTION" && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{t("exceptionBanner")}</span>
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-200">
                    {selectedShipment.exceptionReason || "Delivery held by local courier facility."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleResolveException(selectedShipment.id, "RESCHEDULE")}
                      disabled={Boolean(actionLoading)}
                      className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      <RotateCw className="h-3 w-3 mr-1" />
                      {t("reschedule")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveException(selectedShipment.id, "REROUTE_LOCKER")}
                      disabled={Boolean(actionLoading)}
                      className="h-7 text-xs border-rose-400 text-rose-700 dark:text-rose-300 cursor-pointer"
                    >
                      <Building className="h-3 w-3 mr-1" />
                      {t("rerouteLocker")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveException(selectedShipment.id, "SEND_ALERT")}
                      disabled={Boolean(actionLoading)}
                      className="h-7 text-xs border-rose-400 text-rose-700 dark:text-rose-300 cursor-pointer"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {t("sendCustomerAlert")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Waypoints Timeline */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">Checkpoint Log</h4>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {selectedShipment.waypoints.map((wp, idx) => (
                    <div key={idx} className="relative">
                      <div
                        className={cn(
                          "absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2",
                          wp.completed
                            ? "bg-emerald-500 border-white dark:border-slate-900 text-white"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400",
                        )}
                      >
                        {wp.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="flex items-center justify-between font-mono">
                          <span
                            className={cn(
                              "font-bold",
                              wp.completed ? "text-slate-900 dark:text-white" : "text-slate-400",
                            )}
                          >
                            {wp.location}
                          </span>
                          <span className="text-[10px] text-slate-500">{wp.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{wp.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
