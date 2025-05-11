/** Function that receives a value from a signal */
export type Listener<T> = (value: T) => void;
/** Function that removes a listener when called */
export type Remove = () => void;

/** A lightweight implementation of the observer pattern */
export class Signal<T> {
    /** Set of registered listeners */
    protected readonly slots: Set<Listener<T>>;

    public constructor() {
        this.slots = new Set();
    }

    /** Registers a listener function to be called when values are dispatched */
    public add(listener: Listener<T>): Remove {
        this.slots.add(listener);
        return () => this.remove(listener);
    }

    /** Removes a previously registered listener */
    public remove(listener: Listener<T>): void {
        this.slots.delete(listener);
    }

    /** Adds a listener that will be automatically removed after triggering a specified number of times */
    public limit(listener: Listener<T>, count: number): Remove {
        const wrap = (value: T) => {
            if (count-- > 0) {
                listener(value);
            }
            if (count <= 0) {
                this.remove(wrap);
            }
        };
        return this.add(wrap);
    }

    /** Adds a listener that will be automatically removed after the first trigger */
    public once(listener: Listener<T>): Remove {
        return this.limit(listener, 1);
    }

    /** Returns a Promise that resolves with the next dispatched value */
    public next(): Promise<T> {
        return new Promise<T>((pass) => this.once(pass));
    }

    /** Removes all registered listeners */
    public clear(): void {
        this.slots.clear();
    }

    /** Sends a value to all registered listeners */
    public dispatch(value: T): void {
        for (const slot of Array.from(this.slots)) {
            try {
                slot(value);
            } catch (_) {}
        }
    }

    /** Checks if a specific listener is registered */
    public has(listener: Listener<T>): boolean {
        return this.slots.has(listener);
    }

    /** Returns the number of registered listeners */
    public get size(): number {
        return this.slots.size;
    }
}
