import { AsyncLocalStorage } from "node:async_hooks";
import { DataSource, EntityManager } from "typeorm";
import { assertTenantEntities } from "./tenant-schema";

export const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One instance per named DataSource. All scoped repositories use manager(). */
export class TenantDatabase {
  private ready = false;
  private readonly storage = new AsyncLocalStorage<{
    tenantId?: string;
    manager: EntityManager;
    active: boolean;
  }>();
  constructor(private readonly source: DataSource) {}

  async onModuleInit(): Promise<void> {
    await assertTenantEntities(this.source);
    this.ready = true;
  }

  manager(): EntityManager {
    const state = this.storage.getStore();
    if (!state?.active || !state.manager.queryRunner?.isTransactionActive) {
      throw new Error("A live database context is required");
    }
    return state.manager;
  }

  tenantId(): string | undefined {
    this.manager();
    return this.storage.getStore()?.tenantId;
  }

  runInTenantContext<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    if (!TENANT_ID_PATTERN.test(tenantId))
      throw new Error("Invalid tenant identifier");
    return this.run(tenantId.toLowerCase(), work);
  }

  runUnscoped<T>(work: () => Promise<T>): Promise<T> {
    return this.run(undefined, work);
  }

  private async run<T>(
    tenantId: string | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!this.ready) await this.onModuleInit();
    const existing = this.storage.getStore();
    if (existing) {
      if (!existing.active || existing.tenantId !== tenantId)
        throw new Error("Cannot change or reuse a finished database scope");
      this.manager();
      return work();
    }
    return this.source.transaction(async (manager) => {
      // Empty also masks any accidental session-level value on an unscoped transaction.
      await manager.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId ?? "",
      ]);
      const state = { tenantId, manager, active: true };
      try {
        return await this.storage.run(state, work);
      } finally {
        state.active = false;
      }
    });
  }
}
