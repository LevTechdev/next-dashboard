"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  UsersIcon,
  DollarSignIcon,
} from "lucide-animated";
import { Mail, ShoppingBag } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime, getStatusColor, cn } from "@/lib/utils";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const id = params?.id as string;
  const tcustomers = useTranslations("customers");
  const torders = useTranslations("orders");

  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customers/${id}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setCustomer(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 shimmer rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="h-64 shimmer rounded" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="h-64 shimmer rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <UsersIcon size={48} className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">{tcustomers("notFound")}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/customers`)}>
          <ArrowLeftIcon size={16} className="h-4 w-4 mr-2" />
          {tcustomers("backToCustomers")}
        </Button>
      </div>
    );
  }

  const avgOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/customers`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon size={16} className="h-4 w-4 mr-1" />
            {tcustomers("backToCustomers")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        {customer.segment && (
          <Badge
            className={cn(
              customer.segment === "VIP"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
            )}
          >
            {customer.segment}
          </Badge>
        )}
        <Badge
          className={
            customer.isActive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }
        >
          {customer.isActive ? tcustomers("active") : tcustomers("inactive")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: profile card */}
        <Card className="h-fit">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-20 w-20 mb-3">
                <AvatarImage src={customer.avatar || undefined} alt={customer.name} />
                <AvatarFallback className="text-xl">
                  {customer.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold">{customer.name}</p>
              <p className="text-xs text-gray-500">
                {tcustomers("memberSince")} {formatDateTime(customer.createdAt)}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon size={16} className="h-4 w-4 text-gray-400" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {(customer.city || customer.country) && (
                <div className="flex items-center gap-2">
                  <MapPinIcon size={16} className="h-4 w-4 text-gray-400" />
                  <span>{[customer.city, customer.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {customer.lastOrderDate && (
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} className="h-4 w-4 text-gray-400" />
                  <span>
                    {tcustomers("lastOrder")}: {formatDateTime(customer.lastOrderDate)}
                  </span>
                </div>
              )}
            </div>

            {customer.notes && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-300">
                {customer.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: stats + order history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <DollarSignIcon size={16} className="h-4 w-4" />
                  {tcustomers("totalSpent")}
                </div>
                <p className="text-xl font-bold">{formatCurrency(customer.totalSpent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <ShoppingBag className="h-4 w-4" />
                  {tcustomers("orders")}
                </div>
                <p className="text-xl font-bold">{customer.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <DollarSignIcon size={16} className="h-4 w-4" />
                  {tcustomers("avgOrderValue")}
                </div>
                <p className="text-xl font-bold">{formatCurrency(avgOrderValue)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Order history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tcustomers("recentOrders")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{torders("orderNumber")}</TableHead>
                      <TableHead>{torders("channel")}</TableHead>
                      <TableHead>{torders("status")}</TableHead>
                      <TableHead>{torders("date")}</TableHead>
                      <TableHead className="text-right">{torders("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(customer.orders || []).map((order: any) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/${locale}/orders/${order.id}`)}
                      >
                        <TableCell className="font-medium text-indigo-600 dark:text-indigo-400">
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell>{order.channel?.name || torders("na")}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.grandTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(customer.orders || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {torders("noOrders")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
