import type { ErrorEvent } from "@sentry/nestjs";
import { initErrorTracking, scrubEvent } from "../error-tracking";

describe("error tracking", () => {
  it("stays disabled without SENTRY_DSN", () => {
    expect(initErrorTracking({})).toBe(false);
  });
  it("drops headers, cookies, query, body, user and breadcrumbs", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: "POST",
        url: "https://api.example.com/examples?token=secret",
        headers: { authorization: "Bearer x" },
        cookies: { session: "y" },
        query_string: "token=secret",
        data: { name: "z" },
      },
      user: { id: "usr_1", email: "a@b.c" },
      breadcrumbs: [{ message: "m" }],
    });
    expect(event.request).toEqual({
      method: "POST",
      url: "https://api.example.com/examples",
    });
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
  });
});
