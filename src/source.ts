import { Signal } from "./signal";
import { asyncIterableSource } from "~/factories";

export type Callback<T> = (value: T) => void;
export type Emit<T> = (value: T) => void;
export type Done = () => void;
export type Source<T> = (emit: Emit<T>, done: Done, cleanup: Cleanup) => void;
export type Dispose = () => void;
export type Init = () => Dispose;
export type Cleanup = (dispose: Dispose) => void;
export type Abort = () => void;

export function consume<T>(
    source: Source<T>,
    onEmit?: Callback<T>,
    onDone?: Callback<void>,
    onError?: Callback<any>
): Abort {
    let isDone = false;
    let dispose: Dispose = () => {};

    const emit: Emit<T> = value => {
        if (isDone) return;
        // console.log("EMIT:", value);
        try {
            onEmit?.(value);
        } catch (error) {
            isDone = true;
            dispose();
            onError?.(error);
        }
    };

    const done: Done = () => {
        if (isDone) return;
        isDone = true;
        dispose();
        onDone?.();
    };

    // you can call cleanup multiple times -- all previous cleanup functions will be called
    const cleanup: Cleanup = disposeFn => {
        if (isDone) return;
        const prevDispose = dispose;
        dispose = () => {
            prevDispose();
            disposeFn();
        };
    };

    const abort: Abort = () => {
        if (!isDone) {
            isDone = true;
            dispose();
        }
        // console.log("ABORTED!!!");
        onError?.(new Error("Aborted"));
    };

    try {
        source(emit, done, cleanup);
    } catch (error) {
        onError?.(error);
    }

    return abort;
}

export function collect<T>(source: Source<T>): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const values: T[] = [];
        consume(
            source,
            value => values.push(value),
            () => resolve(values),
            error => reject(error)
        );
    });
}

export function toCallback<T>(signal: Signal<T>): Callback<T> {
    return value => signal.dispatch(value);
}

export async function* toAsyncIterable<T>(source: Source<T>): AsyncGenerator<T> {
    const values: T[] = [];
    let next: (() => void) | null = null;
    let isDone = false;

    const onEmit: Callback<T> = value => {
        if (isDone) return;
        values.push(value);
        if (next) {
            next();
            next = null;
        }
    };

    const onDone: Callback<void> = () => {
        if (isDone) return;
        isDone = true;
        if (next) {
            next();
        }
    };

    const onError: Callback<any> = error => {
        throw error;
    };

    consume(source, onEmit, onDone, onError);

    while (!isDone || values.length > 0) {
        if (values.length === 0 && !isDone) {
            await new Promise<void>(resolve => (next = resolve));
        }

        if (values.length > 0) {
            yield values.shift()!;
        }
    }
}

export function buffered<T>(source: Source<T>): Source<T> {
    return asyncIterableSource(toAsyncIterable(source));
}

export function map<T, U>(source: Source<T>, fn: (value: T) => U): Source<U> {
    return (emit, done, cleanup) => {
        source(value => emit(fn(value)), done, cleanup);
    };
}

export function filter<T>(source: Source<T>, predicate: (value: T) => boolean): Source<T> {
    return (emit, done, cleanup) => {
        source(value => predicate(value) && emit(value), done, cleanup);
    };
}

export function merge<T>(...sources: Source<T>[]): Source<T> {
    return (emit, done, cleanup) => {
        let activeCount = sources.length;
        let isDone = false;

        if (activeCount === 0) {
            return done();
        }

        const onDone: Callback<void> = () => {
            activeCount--;
            if (activeCount === 0 && !isDone) {
                isDone = true;
                done();
            }
        };

        const dispose: Abort = () => {
            aborts.forEach(abort => {
                try {
                    abort();
                } catch (_e) {
                    // Ignore errors during cleanup
                }
            });
            aborts.length = 0;
        };

        const aborts: Abort[] = [];
        cleanup(dispose);

        // Shared error handler
        const onError: Callback<any> = error => {
            if (isDone) return;
            isDone = true;

            // Clean up all sources
            dispose();

            // Propagate the error directly to the consumer
            // This ensures the Promise rejects properly
            throw error;
        };

        for (const source of sources) {
            const abort = consume(source, emit, onDone, onError);
            aborts.push(abort);
        }
    };
}
