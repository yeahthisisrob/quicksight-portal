/**
 * Coalesces concurrent async calls that share a key: while one call is in
 * flight, later callers join its promise instead of starting their own.
 * Nothing is cached — the entry is removed as soon as the flight settles —
 * so freshness semantics of the wrapped operation are unchanged.
 */
export class SingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  public run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const flight = fn().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, flight);
    return flight;
  }
}
