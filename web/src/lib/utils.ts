import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number | null | undefined, currency = "BRL") {
  if (cents === null || cents === undefined) return "-";
  const value = cents / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

export function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "2-digit" });
}



