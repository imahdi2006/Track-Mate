"use client";

/**
 * Per-key debounce + promise mutex.
 *
 * Rapid +1 / +5 taps must:
 *  1. Update UI immediately (caller does optimistic set).
 *  2. Collapse in-flight writes so we persist the *latest* page, not every tap.
 *  3. Never run two network writes for the same book+user at the same time
 *     (otherwise last-write-wins races invert progress).
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const tails = new Map<string, Promise<void>>();

export function debounceMutex(
  key: string,
  fn: () => Promise<void>,
  waitMs: number,
): void {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const prev = tails.get(key) ?? Promise.resolve();
      const next = prev
        .catch(() => undefined)
        .then(fn)
        .catch((err) => {
          console.error(`[PageMate] mutex ${key} failed`, err);
        });
      tails.set(key, next);
    }, waitMs),
  );
}

export function flushDebounce(key: string): void {
  const existing = timers.get(key);
  if (!existing) return;
  clearTimeout(existing);
  timers.delete(key);
}

export async function runExclusive(
  key: string,
  fn: () => Promise<void>,
): Promise<void> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  tails.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  await next;
}
