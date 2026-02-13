import * as React from "react";
import { Text } from "@mantine/core";
import { cn } from "../../lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref as any}
      component="label"
      size="xs"
      fw={700}
      c="dimmed"
      tt="uppercase"
      className={cn("tracking-[0.08em]", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
