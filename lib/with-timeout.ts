export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Reject with TimeoutError if `promise` has not settled within `ms`.
 *
 * The underlying work is not cancelled — this only stops us waiting on it. Use
 * for external calls (CalDAV/iCloud) that have no timeout of their own and
 * would otherwise hang a request forever.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Keep a late rejection from the loser of the race out of Node's
  // unhandled-rejection reporting.
  promise.catch(() => {});

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
