import * as Sentry from "@sentry/nestjs";
import type { ErrorEvent } from "@sentry/nestjs";

/**
 * Errors-only Sentry, enabled by SENTRY_DSN (no DSN = no-op, the default in dev and tests).
 * No tracing, no breadcrumbs and no request headers, cookies, query or body: events carry the
 * stack, the route and the correlation id that also appears in logs and in the problem response.
 */
export function initErrorTracking(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    // Railway injects the deployed commit.
    release: env.SENTRY_RELEASE ?? env.RAILWAY_GIT_COMMIT_SHA,
    // SDK 11 collects these by default; scrubEvent below is the second layer.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  return true;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request)
    event.request = {
      method: event.request.method,
      url: event.request.url?.split("?")[0],
    };
  delete event.user;
  delete event.breadcrumbs;
  return event;
}

/** Reports an unexpected (5xx) failure; no-op when error tracking is disabled. */
export function captureUnexpected(error: unknown, traceId: string): void {
  Sentry.captureException(error, { tags: { traceId } });
}
