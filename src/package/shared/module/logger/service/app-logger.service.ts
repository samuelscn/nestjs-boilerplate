import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Injectable, LoggerService } from "@nestjs/common";
import { ConfigService } from "../../config";
import { SharedConfig } from "../../config/util/shared.config";

export interface LogContext {
  context?: string;
  correlationId?: string;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  duration?: number;
  [key: string]: unknown;
}

@Injectable()
export class AppLogger implements LoggerService {
  private static contextRules: Record<string, number> = {};

  private readonly DEFAULT_CONTEXT = "*";
  private readonly DEFAULT_LEVEL = "info";
  private readonly LOG_LEVEL_MAP: Record<string, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  };

  constructor(
    @InjectPinoLogger()
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService<SharedConfig>,
  ) {
    if (Object.keys(AppLogger.contextRules).length === 0) {
      this.initializeContextRules();
    }
  }

  /**
   * Log de nível TRACE - usado para debugging detalhado
   */
  verbose(message: string, context?: string | LogContext) {
    const ctx = this.normalizeContext(context);
    if (this.shouldLog("trace", ctx.context || "")) {
      this.logger.trace(ctx, message);
    }
  }

  /**
   * Log de nível DEBUG - usado para informações de desenvolvimento
   */
  debug(message: string, context?: string | LogContext) {
    const ctx = this.normalizeContext(context);
    if (this.shouldLog("debug", ctx.context || "")) {
      this.logger.debug(ctx, message);
    }
  }

  /**
   * Log de nível INFO - usado para eventos de negócio importantes
   */
  log(message: string, context?: string | LogContext) {
    const ctx = this.normalizeContext(context);
    if (this.shouldLog("info", ctx.context || "")) {
      this.logger.info(ctx, message);
    }
  }

  /**
   * Log de nível WARN - usado para situações inesperadas mas não críticas
   */
  warn(message: string, context?: string | LogContext) {
    const ctx = this.normalizeContext(context);
    if (this.shouldLog("warn", ctx.context || "")) {
      this.logger.warn(ctx, message);
    }
  }

  /**
   * Log de nível ERROR - usado para erros e exceções
   */
  error(message: string, trace?: string, context?: string | LogContext) {
    const ctx = this.normalizeContext(context);
    if (this.shouldLog("error", ctx.context || "")) {
      this.logger.error({ ...ctx, stack: trace }, message);
    }
  }

  /**
   * Log estruturado para início de operação
   */
  logOperationStart(
    operation: string,
    context: string,
    metadata?: Record<string, unknown>,
  ): number {
    const startTime = Date.now();
    this.log(`[START] ${operation}`, {
      context,
      action: operation,
      ...metadata,
    });
    return startTime;
  }

  /**
   * Log estruturado para fim de operação com sucesso
   */
  logOperationSuccess(
    operation: string,
    context: string,
    startTime: number,
    metadata?: Record<string, unknown>,
  ): void {
    const duration = Date.now() - startTime;
    this.log(`[SUCCESS] ${operation} completed in ${duration}ms`, {
      context,
      action: operation,
      duration,
      ...metadata,
    });
  }

  /**
   * Log estruturado para fim de operação com falha
   */
  logOperationFailure(
    operation: string,
    context: string,
    startTime: number,
    error: Error,
    metadata?: Record<string, unknown>,
  ): void {
    const duration = Date.now() - startTime;
    this.error(
      `[FAILURE] ${operation} failed after ${duration}ms: ${error.message}`,
      error.stack,
      {
        context,
        action: operation,
        duration,
        errorCode:
          "code" in error
            ? (error as Error & { code?: unknown }).code
            : undefined,
        ...metadata,
      },
    );
  }

  /**
   * Log para eventos de domínio (criação, atualização, deleção)
   */
  logDomainEvent(
    event: "CREATED" | "UPDATED" | "DELETED" | "RETRIEVED",
    entity: string,
    entityId: string,
    context: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.log(`[DOMAIN] ${entity} ${event}`, {
      context,
      action: `${entity}_${event}`,
      entity,
      entityId,
      ...metadata,
    });
  }

  private normalizeContext(context?: string | LogContext): LogContext {
    if (typeof context === "string") {
      return { context };
    }
    return context || {};
  }

  private initializeContextRules() {
    const rules = this.configService.get("logRules");
    if (!rules) {
      AppLogger.contextRules[this.DEFAULT_CONTEXT] =
        this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL];
      return;
    }

    const ruleEntries = rules.split("/");
    for (const rule of ruleEntries) {
      let contextPart = this.DEFAULT_CONTEXT;
      let levelPart = this.DEFAULT_LEVEL;
      const parts = rule.split(";");

      for (const part of parts) {
        if (part.startsWith("context=")) {
          contextPart = part.split("=")[1] || this.DEFAULT_CONTEXT;
        } else if (part.startsWith("level=")) {
          levelPart = part.split("=")[1] || this.DEFAULT_LEVEL;
        }
      }

      const contexts = contextPart.split(",");
      const numericLevel =
        this.LOG_LEVEL_MAP[levelPart.trim()] ??
        this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL];

      for (const context of contexts) {
        AppLogger.contextRules[context.trim()] = numericLevel;
      }
    }
  }

  private shouldLog(methodLevel: string, context: string): boolean {
    return this.LOG_LEVEL_MAP[methodLevel] >= this.getLogLevel(context);
  }

  private getLogLevel(context?: string): number {
    context = context ?? "";
    const level =
      AppLogger.contextRules[context] ??
      AppLogger.contextRules[this.DEFAULT_CONTEXT] ??
      this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL];
    return level;
  }
}
