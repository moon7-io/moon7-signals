import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { sleep, timeout } from "~/async";
import {
    Signal,
    Stream,
    signalSource,
    streamSource,
    promiseSource,
    emitterSource,
    eventTargetSource,
    asyncIterableSource,
    throttledIterableSource,
    consume,
} from "~/index";

interface SomeEmitter {
    data: string;
    click: any;
}

describe("Source functions", () => {
    describe("signalSource", () => {
        test("creates a stream from multiple signals", () => {
            const signal1 = new Signal<number>();
            const signal2 = new Signal<number>();

            const stream = Stream.of(signalSource(signal1, signal2));
            const receivedValues: number[] = [];

            stream.add(value => receivedValues.push(value));

            signal1.dispatch(1);
            signal2.dispatch(2);
            signal1.dispatch(3);

            expect(receivedValues).toEqual([1, 2, 3]);
        });

        test("cleanup removes all signal listeners", () => {
            const signal = new Signal<number>();
            const stream = Stream.of(signalSource(signal));

            expect(signal.size).toBe(1);
            stream.close();
            expect(signal.size).toBe(0);
        });

        test("can connect multiple sources to a stream", () => {
            const signal1 = new Signal<number>();
            const signal2 = new Signal<number>();

            // Create a stream and connect sources
            const stream = new Stream<number>();
            stream.connect(signalSource(signal1));
            stream.connect(signalSource(signal2));

            const receivedValues: number[] = [];
            stream.add(value => receivedValues.push(value));

            signal1.dispatch(1);
            signal2.dispatch(2);

            expect(receivedValues).toEqual([1, 2]);
        });
    });

    describe("promiseSource", () => {
        test("emits the resolved value from a promise", async () => {
            const promise = Promise.resolve(42);
            const stream = Stream.of(promiseSource(promise));

            const value = await stream.next();
            expect(value).toBe(42);

            // Stream should be closed after promise resolves
            await new Promise(resolve => setTimeout(resolve, 0)); // Wait for microtasks
            expect(stream.isOpen).toBe(false);
        });

        test("emits values as each promise resolves", async () => {
            // Create promises that resolve at different times
            const promise1 = Promise.resolve(1);
            const promise2 = new Promise<number>(resolve => setTimeout(() => resolve(2), 20));
            const promise3 = new Promise<number>(resolve => setTimeout(() => resolve(3), 10));

            const stream = Stream.of(promiseSource(promise1, promise2, promise3));
            const receivedValues: number[] = [];

            // Collect values as they're emitted
            stream.add(value => receivedValues.push(value));

            // Wait for all promises to resolve
            await new Promise(resolve => setTimeout(resolve, 30));

            // Values should be emitted in order of resolution, not creation
            expect(receivedValues).toContain(1);
            expect(receivedValues).toContain(2);
            expect(receivedValues).toContain(3);
            expect(receivedValues.length).toBe(3);

            // Check that 1 comes first (since it resolves immediately)
            expect(receivedValues[0]).toBe(1);
            // Check that 3 comes before 2 (since it resolves after 10ms vs 20ms)
            expect(receivedValues.indexOf(3)).toBeLessThan(receivedValues.indexOf(2));

            // Stream should be closed after all promises resolve
            expect(stream.isOpen).toBe(false);
        });

        test("completes only after all promises have resolved", async () => {
            // Create promises with different resolution times
            const promise1 = Promise.resolve(10);
            const promise2 = new Promise<number>(resolve => setTimeout(() => resolve(20), 15));

            const stream = Stream.of(promiseSource(promise1, promise2));

            // First value should be available immediately
            const firstValue = await stream.next();
            expect(firstValue).toBe(10);

            // Stream should still be open after first promise resolves
            expect(stream.isOpen).toBe(true);

            // Second value should be available after waiting
            const secondValue = await stream.next();
            expect(secondValue).toBe(20);

            // Give time for completion
            await new Promise(resolve => setTimeout(resolve, 0));

            // Stream should be closed after all promises resolve
            expect(stream.isOpen).toBe(false);
        });

        test("handles rejected promises by throwing the error", async () => {
            // Create a delayed rejected promise
            const delayedRejection = timeout<number>(10);

            // Track received values and errors
            const values: number[] = [];
            let caughtError: unknown = null;

            // Use consume with proper error handling - the way a developer would use it
            consume<number>(
                promiseSource(delayedRejection),
                value => values.push(value),
                () => {}, // done callback
                err => {
                    caughtError = err;
                } // error callback
            );

            // Wait for error to propagate
            await sleep(20);

            // The error should have been caught by the error handler
            expect(caughtError).toBeInstanceOf(Error);
            // Type assertion needed for accessing message property on unknown type
            expect((caughtError as Error).message).toBe("timeout");

            // No values should have been emitted
            expect(values).toEqual([]);
        });

        test("stops emitting after the first rejected promise", async () => {
            // Create multiple promises with the middle one rejecting
            const promise1: Promise<number> = Promise.resolve(100);
            const promise2: Promise<number> = timeout(10);
            const promise3: Promise<number> = new Promise<number>(resolve => setTimeout(() => resolve(300), 20));

            // Track received values and errors
            const receivedValues: number[] = [];
            let caughtError: unknown = null;

            // Use consume with appropriate callbacks - the way a developer would use it
            consume<number>(
                promiseSource(promise1, promise2, promise3),
                value => receivedValues.push(value),
                () => {
                    /* done callback */
                },
                err => {
                    caughtError = err;
                } // error callback
            );

            // Wait for the first promise to resolve
            await sleep(5);

            // First value should be emitted
            expect(receivedValues).toEqual([100]);

            // Wait for the second promise to reject and third to potentially resolve
            await sleep(30);

            // Error should have been caught
            expect(caughtError).toBeInstanceOf(Error);
            expect((caughtError as Error).message).toBe("timeout");

            // Only the first value should have been emitted before the error
            expect(receivedValues).toEqual([100]);
        });
    });

    describe("emitterSource", () => {
        test("creates a stream from a Node.js EventEmitter", () => {
            // Create a mock emitter that implements the EventEmitter interface
            const emitter = {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn().mockImplementation((event, ...args) => {
                    // Find handlers for this event and call them
                    const handler = emitter.on.mock.calls.find(call => call[0] === event)?.[1];
                    if (handler) handler(args[0]);
                }),
            };

            const stream = Stream.of(emitterSource<SomeEmitter>(emitter)("data"));

            const receivedValues: string[] = [];
            stream.add(value => receivedValues.push(value));

            emitter.emit("data", "first");
            emitter.emit("data", "second");

            expect(receivedValues).toEqual(["first", "second"]);
        });

        test("stops receiving events when the stream is closed", () => {
            // Create a mock emitter that implements the EventEmitter interface
            const emitter = {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn().mockImplementation((event, ...args) => {
                    // Find handlers for this event and call them
                    const handler = emitter.on.mock.calls.find(call => call[0] === event)?.[1];
                    if (handler) handler(args[0]);
                }),
            };

            const stream = Stream.of(emitterSource<SomeEmitter>(emitter)("data"));

            const receivedValues: string[] = [];
            stream.add(value => receivedValues.push(value));

            emitter.emit("data", "first");
            stream.close();
            emitter.emit("data", "second");

            expect(receivedValues).toEqual(["first"]);
        });

        test("creates a stream from a DOM EventTarget via emitterSource", () => {
            // Mock EventTarget
            const target = {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                emit: vi.fn().mockImplementation((event, listener) => {
                    // Find handlers for this event and call them
                    const handler = target.addEventListener.mock.calls.find(call => call[0] === event)?.[1];
                    if (handler) handler(listener);
                }),
            };

            const stream = Stream.of(emitterSource<SomeEmitter>(target)("click"));

            // Verify addEventListener was called
            expect(target.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));

            const receivedValues: any[] = [];
            stream.add(value => receivedValues.push(value));

            target.emit("click", { type: "click" });
            expect(receivedValues).toEqual([{ type: "click" }]);

            // Close the stream and verify removeEventListener was called
            stream.close();
            expect(target.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function));
        });

        test("creates a stream from a Node EventEmitter via emitterSource", () => {
            // Mock Node EventEmitter
            const nodeEmitter = {
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatch: vi.fn().mockImplementation((event, data) => {
                    // Find handlers for this event and call them
                    const handler = nodeEmitter.addListener.mock.calls.find(call => call[0] === event)?.[1];
                    if (handler) handler(data);
                }),
            };

            const stream = Stream.of(emitterSource<SomeEmitter>(nodeEmitter)("data"));

            // Verify addListener was called
            expect(nodeEmitter.addListener).toHaveBeenCalledWith("data", expect.any(Function));

            const receivedValues: string[] = [];
            stream.add(value => receivedValues.push(value));

            nodeEmitter.dispatch("data", "test data");
            expect(receivedValues).toEqual(["test data"]);

            // Close the stream and verify removeListener was called
            stream.close();
            expect(nodeEmitter.removeListener).toHaveBeenCalledWith("data", expect.any(Function));
        });

        test("throws error for unsupported emitter type", () => {
            // An object that doesn't implement any of the supported interfaces
            const invalidEmitter: any = {
                someRandomFunction: () => {},
            };

            // Test that the emitterSource function calls fail with the appropriate error
            const source = emitterSource<SomeEmitter>(invalidEmitter)("data");
            const emit = vi.fn();
            const done = vi.fn();
            const fail = vi.fn();
            const cleanup = vi.fn();

            // Execute the source
            source(emit, done, fail, cleanup);

            // Verify fail was called with the correct error
            expect(fail).toHaveBeenCalledWith(expect.any(Error));
            expect(fail.mock.calls[0][0].message).toBe("Unsupported emitter type");
        });
    });

    describe("eventTargetSource", () => {
        test("creates a stream from a DOM EventTarget", () => {
            // Mock EventTarget
            const target = {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };

            const stream = Stream.of(eventTargetSource<SomeEmitter>(target)("click"));

            // Verify addEventListener was called
            expect(target.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), undefined);

            // Close the stream and verify removeEventListener was called
            stream.close();
            expect(target.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), undefined);
        });

        test("passes options to event listeners", () => {
            // Mock EventTarget
            const target = {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };

            const options = { capture: true, passive: true };
            const stream = Stream.of(eventTargetSource<SomeEmitter>(target)("click", options));

            // Verify options were passed
            expect(target.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), options);

            stream.close();
            expect(target.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), options);
        });
    });

    describe("asyncIterableSource", () => {
        test("creates a stream from an async iterable", async () => {
            async function* asyncGenerator() {
                yield 1;
                await Promise.resolve(); // Add a microtask delay
                yield 2;
                await Promise.resolve(); // Add a microtask delay
                yield 3;
            }

            const stream = Stream.of(asyncIterableSource(asyncGenerator()));

            const values: number[] = [];

            // Set up the collection promise
            const collectionPromise = (async () => {
                for await (const value of stream) {
                    values.push(value);
                }
            })();

            // Give the async generator time to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Wait for the collection to complete
            await collectionPromise;

            expect(values).toEqual([1, 2, 3]);
            expect(stream.isOpen).toBe(false);
        });

        test("stops consuming the async iterable when closed", async () => {
            async function* asyncGenerator() {
                for (let i = 0; i < 10; i++) {
                    yield i;
                    await sleep(10);
                }
            }

            const stream = Stream.of(asyncIterableSource(asyncGenerator()));

            let latest = 0;
            stream.add(value => (latest = value));

            await expect(stream.next()).resolves.toBe(0);
            await expect(stream.next()).resolves.toBe(1);
            await expect(stream.next()).resolves.toBe(2);
            await expect(stream.next()).resolves.toBe(3);
            await expect(stream.next()).resolves.toBe(4);

            stream.close();

            await expect(stream.next()).rejects.toThrow("Stream is closed");
            await expect(stream.next()).rejects.toThrow("Stream is closed");

            // Give time for any pending iterations to complete
            await sleep(100);

            // Check that the latest value is still 4
            expect(latest).toBe(4);
        });

        test("handles errors from async iterables", async () => {
            // Create an async generator that throws an error
            async function* errorGenerator() {
                yield 1;
                yield 2;
                throw new Error("Test error from async iterable");
                // This won't be reached
                yield 3;
            }

            // Track received values and errors
            const values: number[] = [];
            let caughtError: unknown = null;

            // Use consume to handle the source
            consume(
                asyncIterableSource(errorGenerator()),
                value => values.push(value),
                () => {}, // done callback
                err => {
                    caughtError = err;
                } // error callback
            );

            // Wait for the generator to yield values and then throw
            await sleep(20);

            // We should receive values before the error
            expect(values).toEqual([1, 2]);

            // The error should be caught and passed to the fail callback
            expect(caughtError).toBeInstanceOf(Error);
            expect((caughtError as Error).message).toBe("Test error from async iterable");
        });
    });

    describe("throttledIterableSource", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        test("creates a stream from a synchronous iterable with delay", async () => {
            const iterable = [1, 2, 3];
            const delay = 100;

            const stream = Stream.of(throttledIterableSource(iterable, delay));
            const receivedValues: number[] = [];

            stream.add(value => receivedValues.push(value));

            // Before any delay, no values should be emitted
            expect(receivedValues).toEqual([]);

            // After the first delay, the first value should be emitted
            await vi.advanceTimersByTimeAsync(delay);
            expect(receivedValues).toEqual([1]);

            // After the second delay, the second value should be emitted
            await vi.advanceTimersByTimeAsync(delay);
            expect(receivedValues).toEqual([1, 2]);

            // After the third delay, the third value should be emitted
            await vi.advanceTimersByTimeAsync(delay);
            expect(receivedValues).toEqual([1, 2, 3]);

            // After all values are emitted, the stream should close
            await vi.advanceTimersByTimeAsync(10);
            expect(stream.isOpen).toBe(false);
        });

        test("handles empty iterables correctly", async () => {
            const emptyIterable: number[] = [];
            const stream = Stream.of(throttledIterableSource(emptyIterable, 100));

            // Advance time to make sure the stream has a chance to process
            await vi.advanceTimersByTimeAsync(10);

            // For empty iterables, the stream is immediately closed
            expect(stream.isOpen).toBe(false);
        });

        test("stops emission when stream is manually closed", async () => {
            const iterable = [1, 2, 3, 4, 5];
            const stream = Stream.of(throttledIterableSource(iterable, 100));

            const receivedValues: number[] = [];
            stream.add(value => receivedValues.push(value));

            // Wait for first delay and first value
            await vi.advanceTimersByTimeAsync(100);
            expect(receivedValues).toEqual([1]);

            // Manually close the stream
            stream.close();

            // Advance time to when all values would have been emitted
            await vi.advanceTimersByTimeAsync(400);

            // Should still only have the first value
            expect(receivedValues).toEqual([1]);
            expect(stream.isOpen).toBe(false);
        });

        test("can be consumed using async iteration", async () => {
            const iterable = [10, 20, 30];
            const stream = Stream.of(throttledIterableSource(iterable, 10));

            const values: number[] = [];

            // Set up the collection promise
            const collectionPromise = (async () => {
                for await (const value of stream) {
                    values.push(value);
                }
            })();

            // Advance time to completion
            await vi.advanceTimersByTimeAsync(40);

            // Wait for the collection to complete
            await collectionPromise;

            expect(values).toEqual([10, 20, 30]);
            expect(stream.isOpen).toBe(false);
        });
    });

    describe("streamSource", () => {
        test("creates a source from multiple streams", () => {
            const stream1 = new Stream<number>();
            const stream2 = new Stream<number>();

            const combinedStream = Stream.of(streamSource(stream1, stream2));
            const receivedValues: number[] = [];

            combinedStream.add(value => receivedValues.push(value));

            stream1.dispatch(1);
            stream2.dispatch(2);
            stream1.dispatch(3);

            expect(receivedValues).toEqual([1, 2, 3]);
        });

        test("cleanup removes all stream listeners", () => {
            const stream = new Stream<number>();
            const sourceStream = Stream.of(streamSource(stream));

            // Streams are implemented using Signal underneath, so we can check size
            expect(stream.size).toBe(1);

            sourceStream.close();
            expect(stream.size).toBe(0);
        });
    });
});
