import * as React from "react";
import { Box, Card as MantineCard, Text } from "@mantine/core";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  [key: string]: any;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <MantineCard
      withBorder
      radius="lg"
      p="md"
      className={cn("shadow-card", className)}
      {...(props as any)}
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
