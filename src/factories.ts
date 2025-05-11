import { sleep } from "./async";
import {
    AddEventListenerOptions,
    Emitter,
    EventHandler,
    EventTarget,
    isEventEmitter,
    isEventTarget,
    isNodeEventTarget,
} from "./emitters";
import { type Remove, Signal } from "./signal";
import { type Source } from "~/source";
import { Stream } from "~/stream";

/** Creates a source that emits values from one or more signals */
export function signalSource<T>(...signals: Signal<T>[]): Source<T> {
    return (emit, done, cleanup) => {
        const removers: Remove[] = signals.map(signal => {
            return signal.add(value => emit(value));
        });
        cleanup(() => removers.forEach(close => close()));
    };
}

/** Creates a source that emits values from one or more streams */
export function streamSource<T>(...streams: Stream<T>[]): Source<T> {
    return signalSource(...streams);
}

/** Creates a source that emits values from an event emitter */
export function emitterSource<S>(emitter: Emitter<S>) {
    // structured this way for better type inference
    return <K extends keyof S>(eventName: K): Source<S[K]> => {
        return (emit, done, cleanup) => {
            const listener: EventHandler<S[K]> = value => emit(value);
            if (isEventEmitter(emitter)) {
                emitter.on(eventName, listener);
                cleanup(() => emitter.off(eventName, listener));
            } else if (isNodeEventTarget(emitter)) {
                emitter.addListener(eventName, listener);
                cleanup(() => emitter.removeListener(eventName, listener));
            } else if (isEventTarget(emitter)) {
                emitter.addEventListener(eventName, listener);
                cleanup(() => emitter.removeEventListener(eventName, listener));
            } else {
                // Only throw if none of the emitter types match
                throw new Error("Unsupported emitter type");
            }
        };
    };
}

/** Creates a source that emits events from a DOM event target */
export function eventTargetSource<S>(target: EventTarget<S>) {
    // structured this way for better type inference
    return <K extends keyof S>(eventName: K, options?: AddEventListenerOptions | boolean): Source<S[K]> => {
        return (emit, done, cleanup) => {
            const listener: EventHandler<S[K]> = event => emit(event);
            target.addEventListener(eventName, listener, options);
            cleanup(() => target.removeEventListener(eventName, listener, options));
        };
    };
}

/** Creates a source that emits values from an async iterable */
export function asyncIterableSource<T>(iterable: AsyncIterable<T>): Source<T> {
    return async (emit, done, cleanup) => {
        let cancelled = false;
        cleanup(() => (cancelled = true));
        try {
            for await (const item of iterable) {
                if (cancelled) break;
                emit(item);
            }
        } finally {
            done();
        }
    };
}

/** Creates a source that emits values from an iterable with a specified delay between emissions */
export function throttledIterableSource<T>(iterable: Iterable<T>, delay: number): Source<T> {
    return async (emit, done) => {
        for (const item of iterable) {
            await sleep(delay);
            emit(item);
        }
        done();
    };
}

/** Creates a source that emits the resolved value of a promise and then completes */
export function promiseSource<T>(promise: Promise<T>): Source<T> {
    return async (emit, done) => {
        try {
            emit(await promise);
            done();
        } catch (error) {
            // Properly handle rejected promises by passing the error to onError
            // We don't call emit here since the promise didn't resolve to a value
            throw error;
        }
    };
}
