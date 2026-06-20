type Handler = (...args: unknown[]) => void;

export class EventEmitter {
  private listeners: Map<string, Array<Handler>> = new Map();

  on(event: string, fn: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  off(event: string, fn: Handler): void {
    const fns = this.listeners.get(event);
    if (fns) {
      const idx = fns.indexOf(fn);
      if (idx !== -1) fns.splice(idx, 1);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (fns) {
      for (const fn of fns) fn(...args);
    }
  }
}
