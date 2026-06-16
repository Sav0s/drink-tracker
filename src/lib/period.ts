import { prisma } from "@/lib/prisma";

/** Returns the currently active billing period, or null if none is open. */
export function getActivePeriod() {
  return prisma.billingPeriod.findFirst({ where: { status: "active" } });
}

/** Formats a date range like the UI expects: "01.06. – 01.07.2026" / "01.06. – heute". */
export function formatPeriodRange(startDate: Date, endDate: Date | null): string {
  const fmtShort = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
  const fmtFull = (d: Date) =>
    `${fmtShort(d)}${d.getFullYear()}`;

  if (!endDate) return `${fmtShort(startDate)} – heute`;
  return `${fmtShort(startDate)} – ${fmtFull(endDate)}`;
}

export function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}
