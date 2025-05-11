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
import { Emit, type Source } from "~/source";
import { Stream } from "~/stream";

/** Creates a source that emits values from one or more signals */
export function signalSource<T>(...signals: Signal<T>[]): Source<T> {
    return (emit, done, fail, cleanup) => {
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

/** Creates a source that emits the resolved value of a promise and then completes */
export function promiseSource<T>(...promises: Promise<T>[]): Source<T> {
    return (emit, done, fail) => {
        let count = promises.length;
        let isDone = false;
        const onResolve: Emit<T> = value => {
            if (isDone) return;
            count--;
            emit(value);
            if (count === 0) {
                isDone = true;
                done();
            }
        };
        const onReject: Emit<any> = error => {
            if (isDone) return;
            isDone = true;
            fail(error);
        };
        promises.forEach(promise => promise.then(onResolve, onReject));
    };
}

/** Creates a source that emits values from an event emitter */
export function emitterSource<S>(emitter: Emitter<S>) {
    // structured this way for better type inference
    return <K extends keyof S>(eventName: K): Source<S[K]> => {
        return (emit, done, fail, cleanup) => {
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
                fail(new Error("Unsupported emitter type"));
            }
        };
    };
}

/** Creates a source that emits events from a DOM event target */
export function eventTargetSource<S>(target: EventTarget<S>) {
    // structured this way for better type inference
    return <K extends keyof S>(eventName: K, options?: AddEventListenerOptions | boolean): Source<S[K]> => {
        return (emit, done, fail, cleanup) => {
            const listener: EventHandler<S[K]> = event => emit(event);
            target.addEventListener(eventName, listener, options);
            cleanup(() => target.removeEventListener(eventName, listener, options));
        };
    };
}

/** Creates a source that emits values from an async iterable */
export function asyncIterableSource<T>(iterable: AsyncIterable<T>): Source<T> {
    return async (emit, done, fail, cleanup) => {
        let cancelled = false;
        cleanup(() => (cancelled = true));
        try {
            for await (const item of iterable) {
                if (cancelled) break;
                emit(item);
            }
            done();
        } catch (error) {
            fail(error);
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
