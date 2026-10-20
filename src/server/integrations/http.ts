// Shared outbound HTTP helper for integrations: enforces a timeout and
// classifies failures as transient (safe to retry later) or permanent.

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ status: number; body: T }> {
  const { timeoutMs = 10_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
    throw new IntegrationError(timedOut ? "Request timed out" : "Network error", true);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body: body as T };
}

export function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
