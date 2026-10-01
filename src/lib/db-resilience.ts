import "server-only";
import { logger } from "@/lib/logger";

// See docs/BUGS.md "DB-connection-burst-503": Turso's HTTP endpoint for a
// libsql: database enforces a per-database concurrent-request ceiling. A warm
// Vercel Fluid Compute instance serving several requests at once — most
// visibly, Next's own RSC-prefetch firing for every visible nav link in the
// same burst — can exceed it, and the client surfaces that as a
// `LibsqlError` (code "SERVER_ERROR") wrapping the original 5xx from Turso's
// edge (see @libsql/client's `mapHranaErrorCode`/`HttpServerError`), which
// previously propagated straight up into a 503 response. The only mitigation
// so far was disabling Next's `prefetch` at specific burst-prone call sites
// (NavLinks.tsx, ContextualRail.tsx, etc.) one at a time — that only reduces
// how often the ceiling gets hit, not what happens when it still does.
//
// `wrapLibsqlExecutor` (used from src/lib/db.ts, below Prisma's own type
// layer so PrismaClient's generated types are completely unaffected) makes
// every statement sent to Turso go through `runWithDbResilience`: a global
// in-process semaphore caps how many statements are in flight at once
// (the rest queue instead of firing together), and a transient SERVER_ERROR
// is retried a few times with backoff instead of failing the request. A
// SERVER_ERROR from Turso's HTTP layer is a pre-execution rejection — the
// statement never reached SQLite — so retrying is safe even for a write
// inside an open transaction: there's nothing already applied to duplicate.
const MAX_CONCURRENT_QUERIES = Number(process.env.DATABASE_MAX_CONCURRENT_QUERIES ?? 8);
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 120;

let activeQueries = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeQueries++;
}

function releaseSlot(): void {
  activeQueries--;
  waitQueue.shift()?.();
}

export function isTransientLibsqlError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  if (code === "SERVER_ERROR" || code === "HRANA_WEBSOCKET_ERROR" || code === "HRANA_CLOSED_ERROR") return true;
  const cause = (error as { cause?: unknown }).cause;
  const status = cause && typeof cause === "object" ? (cause as { status?: number }).status : undefined;
  return typeof status === "number" && status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithDbResilience<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    try {
      return await run();
    } catch (error) {
      if (attempt < MAX_RETRIES && isTransientLibsqlError(error)) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** attempt + Math.random() * 100;
        logger.warn("db: transient error, retrying", error, { attempt, delay: Math.round(delay) });
        await sleep(delay);
        continue;
      }
      throw error;
    } finally {
      releaseSlot();
    }
  }
}

// Transparent wrapper around a @libsql/client `Client` (or the `Transaction`
// object its own `.transaction()` returns — same `execute`/`batch` shape).
// Every other method/getter is passed through unchanged but still bound to
// the real target, not the Proxy — required because the client's internal
// implementation uses private class fields, which throw if ever accessed
// with `this` set to a Proxy rather than the real instance.
export function wrapLibsqlExecutor<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop, _receiver) {
      // Pass `obj` (not the Proxy) as the receiver so a getter's internal
      // `this` sees the real instance too.
      const value = Reflect.get(obj, prop, obj);
      if (typeof value !== "function") return value;

      if (prop === "execute" || prop === "batch") {
        return (...args: unknown[]) => runWithDbResilience(() => (value as (...a: unknown[]) => Promise<unknown>).apply(obj, args));
      }
      if (prop === "transaction") {
        return async (...args: unknown[]) => wrapLibsqlExecutor((await (value as (...a: unknown[]) => Promise<object>).apply(obj, args)) as object);
      }
      return value.bind(obj);
    },
  }) as T;
}
