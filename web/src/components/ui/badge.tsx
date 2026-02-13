import { cn } from "../../lib/utils";
import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "success" | "warning" | "ghost";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-tight",
        variant === "default" && "bg-secondary text-secondary-foreground border-border",
        variant === "outline" && "border-border text-foreground",
        variant === "success" && "bg-emerald-100 text-emerald-700 border-emerald-300",
        variant === "warning" && "bg-amber-100 text-amber-700 border-amber-300",
        variant === "ghost" && "border-transparent text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}



