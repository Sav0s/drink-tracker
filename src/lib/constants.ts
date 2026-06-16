/**
 * Shared string constants — status values, API error messages, and routes.
 * Centralized here so they're not duplicated/misspelled across pages and API routes.
 */

/** BillingPeriod.status values as stored in the database (matches prisma/schema.prisma). */
export const PERIOD_STATUS = {
  ACTIVE: "active",
  CLOSED: "closed",
} as const;
export type PeriodStatus = (typeof PERIOD_STATUS)[keyof typeof PERIOD_STATUS];

/**
 * Display status used on the player-facing "Mein Konto" (profile) screen.
 * Combines period status with payment status; German UI labels live in the
 * component that renders them, not here.
 */
export const PROFILE_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  PAID: "paid",
} as const;
export type ProfileStatus = (typeof PROFILE_STATUS)[keyof typeof PROFILE_STATUS];

/** Error messages returned by API routes (kept in English per repo-language convention). */
export const API_ERROR = {
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  NO_ACTIVE_PERIOD: "No active billing period",
  DRINK_ID_REQUIRED: "drinkId required",
  START_DATE_REQUIRED: "startDate required",
  NAME_AND_PRICE_REQUIRED: "name and price_cents required",
  PAYMENT_FIELDS_REQUIRED: "playerId, periodId, paid required",
} as const;

/** App routes, used in router.push() calls and the proxy (route guards). */
export const ROUTES = {
  LOGIN: "/login",
  HOME: "/home",
  PROFILE: "/profile",
  ADMIN_LOGIN: "/admin/login",
  ADMIN_DASHBOARD: "/admin/dashboard",
} as const;

/** Route prefixes guarded by src/proxy.ts — unauthenticated users are redirected to ROUTES.LOGIN. */
export const PROTECTED_ROUTES = [ROUTES.HOME, ROUTES.PROFILE, "/admin"] as const;

/** Fallback player name shown when no name can be derived from the auth profile. */
export const DEFAULT_PLAYER_NAME = "Spieler";

/** Fallback copy shown when a closed billing period has no payment instructions set. */
export const NO_PAYMENT_INSTRUCTIONS_FALLBACK =
  "Bitte beim Kassenwart erfragen, wie die Zahlung erfolgen soll.";
