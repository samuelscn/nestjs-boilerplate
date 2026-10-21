import type { ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { LoggingInterceptor } from "src/package/shared/module/logger/interceptor/logging.interceptor";
import { AppLogger } from "src/package/shared/module/logger";

describe("Authentication logging", () => {
  it("preserves useful request data and recursively redacts secrets without mutating inputs", async () => {
    const logger = { log: jest.fn(), debug: jest.fn() };
    const interceptor = new LoggingInterceptor(logger as unknown as AppLogger);
    const sensitiveFields = [
      "password",
      "senha",
      "Authorization",
      "accessToken",
      "access_token",
      "Access-Token",
      "refreshToken",
      "refresh_token",
      "idToken",
      "client_secret",
      "clientSecret",
      "cookie",
      "Set-Cookie",
      "sessionCookie",
      "apiKey",
      "identityUserId",
      "user_id",
      "CPF",
      "cnpj",
      "email",
      "phone",
    ];
    const secrets = Object.fromEntries(
      sensitiveFields.map((key) => [key, `private-${key}`]),
    );
    const body = {
      enabled: true,
      count: 2,
      optional: null,
      items: [{ label: "useful", nested: secrets }, "plain text", 0, false],
    };
    const original = structuredClone(body);
    const query = {
      page: "2",
      filter: { status: "active", token: "private-query" },
    };
    const params = { resourceId: "item-42", userId: "private-user" };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          path: "/items/item-42",
          originalUrl: "/items/item-42?token=private-query",
          headers: {},
          body,
          query,
          params,
          get: () => "test-client/1.0",
        }),
        getResponse: () => ({ statusCode: 200, setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );
    expect(logger.log.mock.calls[0]).toEqual([
      "[REQUEST] POST /items/item-42",
      expect.objectContaining({
        url: "/items/item-42",
        query: { page: "2", filter: { status: "active", token: "[REDACTED]" } },
        params: { resourceId: "item-42", userId: "[REDACTED]" },
        body: {
          enabled: true,
          count: 2,
          optional: null,
          items: [
            {
              label: "useful",
              nested: Object.fromEntries(
                sensitiveFields.map((key) => [key, "[REDACTED]"]),
              ),
            },
            "plain text",
            0,
            false,
          ],
        },
        userAgent: "test-client/1.0",
      }),
    ]);
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("private-");
    expect(body).toEqual(original);
    expect(query.filter.token).toBe("private-query");
    expect(params.userId).toBe("private-user");
  });

  it("does not record bearer/query/body/cookie credentials or arbitrary correlation IDs", async () => {
    const secret = "eyJhbGciOiJSUzI1NiJ9.secret.signature";
    const logger = { log: jest.fn(), debug: jest.fn() };
    const interceptor = new LoggingInterceptor(logger as unknown as AppLogger);
    const response = { statusCode: 200, setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          path: "/access/roles",
          originalUrl: `/access/roles?access_token=${secret}`,
          headers: {
            authorization: `Bearer ${secret}`,
            cookie: secret,
            "x-correlation-id": secret,
          },
          body: { arbitrary: secret },
          query: { access_token: secret },
          params: {},
          get: () => secret,
        }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(secret);
    expect(response.setHeader).toHaveBeenCalledWith(
      "x-correlation-id",
      expect.stringMatching(/^[a-f0-9-]{36}$/),
    );
  });
});
