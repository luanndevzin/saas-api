import * as React from "react";
import { Box, Card as MantineCard, CardProps as MantineCardProps, Text } from "@mantine/core";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: MantineCardProps) {
  return (
    <MantineCard
      withBorder
      radius="lg"
      p="md"
      className={cn("shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Box className={cn("mb-3 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Text component="h3" fw={600} className={cn("text-lg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <Text component="p" c="dimmed" size="sm" className={cn(className)} {...props} />;
}
