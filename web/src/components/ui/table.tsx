import * as React from "react";
import { cn } from "../../lib/utils";

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-x-auto rounded-xl border border-border/70 bg-background/30">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);

export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-muted/40 text-xs uppercase text-muted-foreground", className)} {...props} />
);

export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-border/60", className)} {...props} />
);

export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("hover:bg-muted/45", className)} {...props} />
);

export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("px-3 py-2.5 text-left font-semibold", className)} {...props} />
);

export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />
);
