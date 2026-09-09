"use client";

import { type ComponentType } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
}

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6", className)}>
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4"
      >
        <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800/60">
          <Icon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">{description}</p>
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Button asChild size="sm">
              <Link href={action.href} className="gap-2">
                {action.icon && <action.icon className="h-4 w-4" />}
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick} className="gap-2">
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
