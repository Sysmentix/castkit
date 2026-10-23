/**
 * Lightweight, strictly typed event emitter compatible with both Node and Browser
 */

export type EventListener<T = any> = (data: T) => void | Promise<void>;

export class TypedEventEmitter<Events extends Record<string, any>> {
  private listeners: Map<keyof Events, Set<EventListener<any>>> = new Map();

  public on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  public once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    const onceWrapper = (data: Events[K]) => {
      this.off(event, onceWrapper);
      listener(data);
    };
    return this.on(event, onceWrapper);
  }

  public off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const listener of Array.from(set)) {
      try {
        listener(data);
      } catch (err) {
        console.error(`Error in event listener for "${String(event)}":`, err);
      }
    }
  }

  public removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  public listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
