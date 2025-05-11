import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { sleep } from "~/async";
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

        test("handles rejected promises by throwing the error", async () => {
            const error = new Error("Test error");
            const promise = Promise.reject(error);

            // Create the source function but don't connect it to a Stream yet
            const source = promiseSource(promise);

            // Set up mock functions
            const emit = vi.fn();
            const done = vi.fn();
            const cleanup = vi.fn();

            // Call the source directly and catch the error
            try {
                await source(emit, done, cleanup);
            } catch (e) {
                // Verify it's the original error
                expect(e).toBe(error);
            }

            // Verify emit and done were not called
            expect(emit).not.toHaveBeenCalled();
            expect(done).not.toHaveBeenCalled();
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

            // Test the emitterSource function directly, not wrapped in Stream.of
            expect(() => {
                // Create the source
                const source = emitterSource<SomeEmitter>(invalidEmitter)("data");
                // Call the source function to trigger the error
                const emit = () => {};
                const done = () => {};
                const cleanup = () => {};
                source(emit, done, cleanup);
            }).toThrow("Unsupported emitter type");
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
