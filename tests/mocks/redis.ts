/**
 * Stands in for `config/redis.ts` in every test, so no suite opens a socket.
 * Backed by a real Map, so idempotency and rate-limit tests can assert on behaviour
 * rather than on call counts.
 */
type Stored = { value: string; expiresAt: number | null };

const store = new Map<string, Stored>();

const live = (key: string): Stored | null => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry;
};

const ttlToExpiry = (seconds: number) => Date.now() + seconds * 1000;

export const redis = {
  status: "ready",

  async get(key: string): Promise<string | null> {
    return live(key)?.value ?? null;
  },

  /** Supports the `set(key, value, "EX", n, "NX")` form in use. */
  async set(
    key: string,
    value: string,
    ...args: (string | number)[]
  ): Promise<"OK" | null> {
    const flags = args.map((arg) => String(arg).toUpperCase());
    const exIndex = flags.indexOf("EX");
    const seconds = exIndex === -1 ? null : Number(args[exIndex + 1]);

    if (flags.includes("NX") && live(key)) return null;

    store.set(key, { value, expiresAt: seconds === null ? null : ttlToExpiry(seconds) });
    return "OK";
  },

  async del(key: string): Promise<number> {
    return store.delete(key) ? 1 : 0;
  },

  /** The token bucket in `lib/ratelimit/limiter.ts`, in JS. The Lua itself is exercised against real Redis only. */
  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    ...args: string[]
  ): Promise<[number, number, number]> {
    const [capacity, refill, now, cost, ttl] = args.map(Number) as [
      number, number, number, number, number,
    ];
    const bucket = live(key);
    const state = bucket
      ? (JSON.parse(bucket.value) as { tokens: number; ts: number })
      : { tokens: capacity, ts: now };

    let tokens = Math.min(capacity, state.tokens + (Math.max(0, now - state.ts) / 1000) * refill);
    const allowed = tokens >= cost ? 1 : 0;
    if (allowed) tokens -= cost;

    store.set(key, { value: JSON.stringify({ tokens, ts: now }), expiresAt: Date.now() + ttl });

    const retryAfterMs = allowed ? 0 : Math.ceil(((cost - tokens) / refill) * 1000);
    return [allowed, Math.floor(tokens), retryAfterMs];
  },
};

/** Tests own the state they set up. */
export const __resetRedis = () => {
  store.clear();
};

/** Seconds left on a key, or null if it has none — for asserting a TTL was not reset. */
export const __ttlSeconds = (key: string): number | null => {
  const entry = live(key);
  if (!entry || entry.expiresAt === null) return null;
  return Math.round((entry.expiresAt - Date.now()) / 1000);
};
