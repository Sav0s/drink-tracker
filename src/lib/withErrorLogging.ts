import { NextResponse } from "next/server";
import { logger, toErrorMessage } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/**
 * Wraps an API route handler so an unexpected thrown exception is logged as
 * server_error and turned into a uniform 500 JSON response instead of
 * crashing the route. Deliberately-returned error responses (401/403/400/...)
 * pass through untouched — this only catches exceptions the handler itself
 * didn't handle.
 */
export function withErrorLogging<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const message = toErrorMessage(e);
      logger.error(LOG_EVENT.SERVER_ERROR, { meta: { route: routeName, message } });
      return NextResponse.json({ error: API_ERROR.INTERNAL_ERROR }, { status: 500 });
    }
  };
}
