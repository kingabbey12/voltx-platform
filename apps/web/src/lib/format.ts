import { formatDistanceToNowStrict } from "date-fns";

export function formatRelativeTime(iso: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}
