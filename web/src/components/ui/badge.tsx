import { Badge as MantineBadge, BadgeProps as MantineBadgeProps } from "@mantine/core";

type BadgeVariant = "default" | "outline" | "success" | "warning" | "ghost";

export interface BadgeProps extends Omit<MantineBadgeProps, "variant" | "color"> {
  variant?: BadgeVariant;
}

function mapBadge(variant: BadgeVariant = "default") {
  switch (variant) {
    case "outline":
      return { variant: "outline" as const, color: "gray" as const };
    case "success":
      return { variant: "light" as const, color: "teal" as const };
    case "warning":
      return { variant: "light" as const, color: "yellow" as const };
    case "ghost":
      return { variant: "transparent" as const, color: "gray" as const };
    default:
      return { variant: "light" as const, color: "blue" as const };
  }
}

export function Badge({ variant = "default", ...props }: BadgeProps) {
  const mapped = mapBadge(variant);
  return (
    <MantineBadge
      radius="xl"
      size="sm"
      tt="uppercase"
      fw={700}
      variant={mapped.variant}
      color={mapped.color}
      {...props}
    />
  );
}
