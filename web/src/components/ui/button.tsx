import { Button as MantineButton, ButtonProps as MantineButtonProps } from "@mantine/core";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline" | "destructive";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends Omit<MantineButtonProps, "variant" | "size" | "color"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function resolveVariant(variant: ButtonVariant = "default") {
  switch (variant) {
    case "secondary":
      return { variant: "light" as const, color: "gray" as const };
    case "ghost":
      return { variant: "subtle" as const, color: "gray" as const };
    case "outline":
      return { variant: "outline" as const, color: "gray" as const };
    case "destructive":
      return { variant: "filled" as const, color: "red" as const };
    default:
      return { variant: "filled" as const, color: "cyan" as const };
  }
}

function resolveSize(size: ButtonSize = "md") {
  switch (size) {
    case "xs":
      return "xs" as const;
    case "sm":
      return "sm" as const;
    case "lg":
      return "lg" as const;
    default:
      return "md" as const;
  }
}

export function Button({ variant = "default", size = "md", style, ...props }: ButtonProps) {
  const mapped = resolveVariant(variant);
  const mappedSize = resolveSize(size);

  return (
    <MantineButton
      radius="md"
      variant={mapped.variant}
      color={mapped.color}
      size={mappedSize}
      style={
        size === "icon"
          ? { width: 40, height: 40, padding: 0, ...(style || {}) }
          : style
      }
      {...props}
    />
  );
}

export const buttonVariants = () => "";
