import { type Listener, type Remove, Signal } from "./signal";
import { type EventEmitter } from "~/emitters";

/** Determines parameter types for dispatch based on if event value is void */
export type DispatchArgs<S, K extends keyof S> = S[K] extends void
    ? [key: K, value?: undefined]
    : [key: K, value: S[K]];

/** A hub for managing multiple signals organized by keys */
export class SignalHub<S> implements EventEmitter<S> {
    /** Map of signals indexed by key */
    private readonly map: Map<keyof S, Signal<any>>;

    public constructor() {
        this.map = new Map();
    }

    /** Gets or creates a signal for the specified key */
    public signal<K extends keyof S>(key: K): Signal<S[K]> {
        let signal = this.map.get(key);
        if (!signal) {
            signal = new Signal<S[K]>();
            this.map.set(key, signal);
        }
        return signal;
    }

    /** Adds a listener for a specific key */
    public add<K extends keyof S>(key: K, listener: Listener<S[K]>): Remove {
        return this.signal(key).add(listener);
    }

    /** Removes a listener for a specific key */
    public remove<K extends keyof S>(key: K, listener: Listener<S[K]>): void {
        return this.signal(key).remove(listener);
    }

    /** Adds a listener for a specific key */
    public on<K extends keyof S>(key: K, listener: Listener<S[K]>): Remove {
        return this.add(key, listener);
    }

    /** Removes a listener for a specific key */
    public off<K extends keyof S>(key: K, listener: Listener<S[K]>): void {
        return this.remove(key, listener);
    }

    /** Adds a listener with a count limit for a specific key */
    public limit<K extends keyof S>(key: K, listener: Listener<S[K]>, count: number): Remove {
        return this.signal(key).limit(listener, count);
    }

    /** Adds a one-time listener for a specific key */
    public once<K extends keyof S>(key: K, listener: Listener<S[K]>): Remove {
        return this.signal(key).once(listener);
    }

    /** Returns a promise that resolves with the next value dispatched for a key */
    public next<K extends keyof S>(key: K): Promise<S[K]> {
        return this.signal(key).next();
    }

    /** Checks if a specific listener is registered for a key */
    public has<K extends keyof S>(key: K, listener: Listener<S[K]>): boolean {
        if (!this.map.has(key)) return false;
        return this.signal(key).has(listener);
    }

    /** Gets the number of listeners for a specific key */
    public size<K extends keyof S>(key: K): number {
        if (!this.map.has(key)) return 0;
        return this.signal(key).size;
    }

    /** Clears all listeners for a specific key */
    public clear<K extends keyof S>(key: K): void {
        this.signal(key).clear();
    }

    /** Clears all listeners for all keys */
    public clearAll(): void {
        this.map.forEach(signal => signal.clear());
    }

    /** Dispatches a value for a specific key */
    public dispatch<K extends keyof S>(...[key, value]: DispatchArgs<S, K>): void {
        return this.signal(key).dispatch(value!);
    }

    /** Returns all keys that have been accessed */
    public keys(): IterableIterator<keyof S> {
        return this.map.keys();
    }

    /** Checks if a key has been accessed */
    public hasKey<K extends keyof S>(key: K): boolean {
        return this.map.has(key);
    }

    /** Deletes a key and its associated signal */
    public delete<K extends keyof S>(key: K): boolean {
        return this.map.delete(key);
    }
}

/*
example usage:
    interface FooSignals {
        foo: number;
        bar: string;
        yoo: void;
    }

    const s = new SignalHub<FooSignals>();

    s.dispatch("foo", 1);
    s.dispatch("foo", "bar"); // error
    s.dispatch("bar", "bar");
    s.dispatch("bar", 123); // error
    s.dispatch("yoo");
    s.dispatch("yoo", 123); // error

    s.on("foo", (value) => value);
    s.on("yoo", (value) => value);

    // same as above
    s.signal("foo").add((value) => value);
*/
