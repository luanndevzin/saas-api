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
        variant === "default" && "bg-secondary text-secondary-foreground border-secondary/60",
        variant === "outline" && "border-border text-foreground",
        variant === "success" && "bg-emerald-500/15 text-emerald-200 border-emerald-500/50",
        variant === "warning" && "bg-amber-500/15 text-amber-200 border-amber-500/60",
        variant === "ghost" && "border-transparent text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}



