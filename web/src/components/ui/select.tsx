import * as React from "react";
import { cn } from "../../lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const { className, children, ...rest } = props;
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };



