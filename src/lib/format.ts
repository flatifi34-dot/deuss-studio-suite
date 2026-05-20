export function eur(n: number | string | null | undefined) {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(v || 0);
}

export function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}