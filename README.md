# @moon7/signals

A lightweight, type-safe reactive programming library for TypeScript.

[![npm version](https://img.shields.io/npm/v/@moon7/signals.svg)](https://www.npmjs.com/package/@moon7/signals)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Background

The [signal-slot pattern](https://en.wikipedia.org/wiki/Signals_and_slots) provides a type-safe event communication system that offers an alternative to JavaScript's EventTarget and EventEmitter patterns with better type safety, cleaner APIs, and functional composition capabilities.

This library implements this pattern with modern TypeScript, adding streaming capabilities inspired by reactive programming.

## Features

- 🍃 **Lightweight**: Small footprint with zero dependencies
- 🔍 **Type-Safe**: Full TypeScript support with proper type inference
- 🧩 **Modular**: Use only what you need - Signal, Source, Stream, or SignalHub
- 🔄 **Reactive**: Functional reactive programming patterns
- 🔌 **Interoperable**: Works with DOM events, Node.js EventEmitter, Promises, and iterables

## Installation

```bash
# npm
npm install @moon7/signals

# pnpm
pnpm add @moon7/signals

# yarn
yarn add @moon7/signals
```

## Concepts

### Signal

A `Signal` is a typed event emitter that implements the [signal-slot pattern](https://en.wikipedia.org/wiki/Signals_and_slots), providing a type-safe alternative to JavaScript's EventTarget/EventEmitter with cleaner syntax and better TypeScript integration.

### Source

A `Source` is a functional abstraction that produces values over time using callbacks instead of generators. Its functional design allows you to write composable higher-order functions that transform sources, creating powerful data flow pipelines.

### Stream

A `Stream` extends `Signal` and connects to one or more `Source` functions, combining event handling with reactive data flows. It provides lifecycle management and functional operators like map, filter, and take.

### SignalHub

A `SignalHub` serves as a centralized registry of typed signals organized by keys, making it easy to manage multiple event channels with full type safety across your application.

## Basic Usage

### Signal

```typescript
import { Signal } from "@moon7/signals";

// Create a signal for mouse events
const clicked = new Signal<{ x: number; y: number }>();

// Add a listener
const remove = clicked.add(event => {
    console.log(`Click: ${event.x},${event.y}`);
});

// Dispatch values
clicked.dispatch({ x: 3, y: 4 });  // logs: "Click: 3,4"
clicked.dispatch({ x: 10, y: 20 });  // logs: "Click: 10,20"

// Remove the listener when done
remove();

// Or add a one-time listener
clicked.once(event => {
    console.log(`Final: ${event.x},${event.y}`);
});

// Auto-removed after first trigger
clicked.dispatch({ x: 100, y: 200 });  // logs: "Final: 100,200"
```

### Source

```typescript
import { consume, Source } from "@moon7/signals";

// Create a source that emits values over time
const numberSource: Source<number> = (emit, done, cleanup) => {
    let counter = 0;
    const interval = setInterval(() => {
        emit(counter++);
        if (counter > 5) {
            done();
        }
    }, 1000);
    
    // Register cleanup function that will be called when consumer aborts
    cleanup(() => clearInterval(interval));
};

// Consume the source directly
const abort = consume(
    numberSource,
    value => console.log(`Value: ${value}`),
    () => console.log("Done!"),
    error => console.error("Error:", error)
);

// Call abort() to stop consuming early
// abort();
```

### Stream

```typescript
import { Stream, eventTargetSource, throttledIterableSource, map } from "@moon7/signals";

interface Events {
    click: MouseEvent;
}

// Create a stream from a source function
const clickStream = Stream.of(eventTargetSource<Events>(window)("click"));
// type of clickStream inferred to be Stream<MouseEvent>

// Add a listener to handle events
clickStream.add(event => console.log(`Clicked: ${event.clientX},${event.clientY}`));

// Create a stream from an iterable with throttling
const numberStream = Stream.of(throttledIterableSource([1, 2, 3, 4, 5], 1000)); // Emits numbers every second

// Add error handling
numberStream.onError.add(error => console.error("Stream error:", error));

// Clean up when done
numberStream.onDone.add(() => console.log("Stream complete"));

// Connect multiple sources to a single stream
const multiStream = new Stream<number>();
multiStream.connect(throttledIterableSource([1, 2, 3], 1000));
// Later, connect another source
const dom = document.getElementById("button");
const clientXSource = map(eventTargetSource(dom)("click"), event => event.clientX);
multiStream.connect(clientXSource);
```

> ⚠️ `Stream` does not buffer values. Listeners only receive values emitted after they are added. You can re-order when you add listeners, to properly capture the events.

```typescript
// This won't work as expected:
const stream = Stream.of<number>((emit, done) => {
    // These values are emitted before any listeners are attached
    emit(1);
    emit(2);
    emit(3);
    done();
});

// This listener is added too late and won't receive the values
stream.add(value => console.log(value));
```

```typescript
// Create a stream without a source
const stream = new Stream<number>();

// Register listeners
stream.add(value => console.log(value));

// As listeners have already been added, these values will be captured
stream.connect((emit, done) => {
    emit(1);
    emit(2);
    emit(3);
    done();
});
```

### SignalHub

```typescript
import { SignalHub } from "@moon7/signals";

// Define your event types
interface AppEvents {
    login: { userId: string; timestamp: number };
    notify: { message: string; type: "info" | "error" | "success" };
    ready: void;  // Events with no payload use void
}

// Create a hub
const hub = new SignalHub<AppEvents>();

// Listen for events
hub.on("login", ({ userId, timestamp }) => {
    console.log(`User ${userId} logged in at ${new Date(timestamp)}`);
});

hub.on("notify", ({ message, type }) => {
    console.log(`[${type}] ${message}`);
});

// Listen for void events (no payload)
hub.on("ready", () => {
    console.log("App is ready!");
});

// Dispatch events with type checking
hub.dispatch("login", { userId: "user123", timestamp: Date.now() });
hub.dispatch("notify", { message: "Hello world", type: "info" });
hub.dispatch("ready");  // No payload needed for void events
```

## Source Factory Functions

The library provides a number of source factory functions for convenience, allowing you to create streams from various data sources, such as from DOM EventTargets, or other EventEmitters.

```typescript
import { 
    Stream,
    signalSource, 
    promiseSource, 
    eventTargetSource, 
    emitterSource, 
    asyncIterableSource,
    throttledIterableSource
} from "@moon7/signals";

// Create a stream from multiple signals
const signal1 = new Signal<number>();
const signal2 = new Signal<number>();
const combinedStream = Stream.of(signalSource(signal1, signal2));

// Create a stream from a Promise (emits once then completes)
const responseStream = Stream.of(promiseSource(Promise.resolve("hello")));

// Create a stream from DOM events
const button = document.getElementById("button");
const clickStream = Stream.of(eventTargetSource(button)("click"));

// Create a stream from an async iterable
async function* generateData() {
    for (let i = 0; i < 10; i++) {
        yield i;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
const asyncStream = Stream.of(asyncIterableSource(generateData()));

// Create a stream from an iterable with a delay between emissions
const numbers = [1, 2, 3, 4, 5];
const delayedStream = Stream.of(throttledIterableSource(numbers, 200)); // 200ms between emissions

// Connect multiple sources to a single stream
const multiSourceStream = new Stream<number>();
multiSourceStream.connect(signalSource(signal1));
multiSourceStream.connect(asyncIterableSource(generateData()));
```

You can choose to use a Source with a Stream, or directly using one of the source functions.

```typescript
import { sleep } from "@moon7/async";
import { Source, Stream, Signal, consume, toCallback, Done, Emit } from "@moon7/signals";

// define a source
const mySource: Source<number> = async (emit, done) => {
    for (let i = 0; i < 10; i++) {
        await sleep(1000);
        emit(i);
    }
    done();
};

// connect a stream to a source immediately
const stream1 = Stream.of(mySource);

// alternatively, connect a stream to a source later
const stream2 = new Stream<number>();
stream2.add(value => console.log(value));
stream2.connect(mySource);

// or use the lower-level functions for more control
const onEmit: Emit<number> = value => console.log(value);
const onDone: Done = () => console.log("completed");
const abort = consume(mySource, onEmit, onDone);

// or attach it to a pre-existing Signal
const signal = new Signal<number>();
signal.add(value => console.log(value));
const onDone: Done = () => console.log("completed");
const abort = consume(mySource, toCallback(signal), onDone);
```

## Source and Stream Operations

Sources and Streams support a rich set of functional operations that let you transform, filter, and combine data.

### Source Operations

```typescript
import { sleep } from "@moon7/async";
import { Source, map, filter } from "@moon7/signals";

// define a source
const mySource: Source<number> = async (emit, done) => {
    for (let i = 0; i < 10; i++) {
        await sleep(1000);
        emit(i);
    }
    done();
};

// create a source from the input source, where emitted values are doubled
const mappedSource = map(mySource, value => value * 2);

// create a source from the input source, where only certain values are emitted
const filteredSource = filter(mySource, value => value % 2 === 0);

// merge multiple sources into a single source
const mergedSource = merge(mappedSource, mySource, filteredSource);
```

### Stream Operations

```typescript
// Source stream of numbers
const sourceStream = new Stream<number>();

// Transform: keep only even numbers and multiply by 10
const processedStream = sourceStream
    .filter(n => n % 2 === 0)  // 2, 4
    .map(n => n * 10);         // 20, 40

// Take only the first 3 values
const limitedStream = sourceStream.take(3);  // 1, 2, 3

// Skip the first 2 values
const skippedStream = sourceStream.skip(2);  // 3, 4, 5

// Pipe to another stream
const targetStream = new Stream<number>();
sourceStream.pipe(targetStream);

// Emit values
[1, 2, 3, 4, 5].forEach(n => sourceStream.dispatch(n));
```

## Async/Await with Streams

```typescript
async function processStream() {
    const stream = Stream.of<number>((emit, done) => {
        setTimeout(() => emit(1), 100);
        setTimeout(() => emit(2), 200);
        setTimeout(() => emit(3), 300);
        setTimeout(() => done(), 400);
    });

    // Get next value (Promise-based)
    const firstValue = await stream.next();
    console.log(`First value: ${firstValue}`);

    // Process all remaining values using async iterator
    for await (const value of stream) {
        console.log(`Got value: ${value}`);
    }
    console.log("Stream completed");
}
```

### Websocket Example

```typescript
import { Source, Stream } from '@moon7/signals';
import { WebSocket, WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';

// Create a source factory function for WebSockets
const websocketSource = (ws: WebSocket): Source<any> => (emit, done, cleanup) => {
    const onMessage = (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            emit(message);
        } catch (error) {
            emit({ error: 'Failed to parse message', raw: data.toString() });
        }
    };

    const onClose = () => {
        done();
    };

    const onError = () => {
        emit({ error: error.message });
        done();
    };

    // Set up event handlers
    ws.on('message', onMessage);
    ws.on('close', onClose);
    ws.on('error', onError);

    // Cleanup function to remove event listeners
    cleanup(() => {
        ws.off('message', onMessage);
        ws.off('close', onClose);
        ws.off('error', onError);
    });
};

// Express server with WebSocket example
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', async (ws) => {
    console.log('Client connected');
    
    // Create a stream from the WebSocket
    const stream = Stream.of(websocketSource(ws));
    
    // Send a welcome message
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to server' }));
    
    try {
        // Process messages using async/await
        for await (const message of stream) {
            console.log('Received message:', message);
            
            // Example: Echo back messages with a timestamp
            if (message.type === 'chat') {
                ws.send(JSON.stringify({
                    type: 'chat',
                    text: message.text,
                    echo: true,
                    timestamp: Date.now()
                }));
            }
        }
        
        // The for-await loop exits when the WebSocket closes
        console.log('Client disconnected gracefully');
    } catch (error) {
        console.error('Error processing WebSocket stream:', error);
    }
});
```

## Error Handling

```typescript
const stream = Stream.of<number>((emit, done) => {
    try {
        emit(1);
        throw new Error("Something went wrong");
    } catch (error) {
        // Errors in the source function will be caught and propagated
        throw error;
    }
});

// Errors during dispatch are sent to onError
stream.onError.add(error => {
    console.error("Error in stream:", error);
});
```

## API Reference

### Signal

- `add(listener)` - Registers a listener, returns a function to remove it
- `remove(listener)` - Removes a previously registered listener
- `once(listener)` - Adds a one-time listener that auto-removes after triggering
- `limit(listener, count)` - Adds a listener with a limit on how many times it will trigger
- `dispatch(value)` - Sends a value to all registered listeners
- `next()` - Returns a promise that resolves with the next dispatched value
- `clear()` - Removes all registered listeners
- `has(listener)` - Checks if a specific listener is registered
- `size` - Number of registered listeners

### Source Functions

- `consume(source, onEmit, onDone, onError)` - Consumes a source, calling the provided callbacks
- `collect(source)` - Collects all values from a source into an array Promise
- `map(source, fn)` - Transforms values from a source using a mapping function
- `filter(source, predicate)` - Filters values from a source based on a predicate
- `merge(...sources)` - Merge multiple sources into a single source
- `buffered(source)` - Creates a buffered version of a source that stores emitted values
- `toAsyncIterable(source)` - Converts a source to an async iterable
- `toCallback(signal)` - Converts a signal to a callback function

### Stream

- `new Stream()` - Creates a new empty stream
- `Stream.of(source)` - Static factory method to create a new stream with a source function
- `connect(source)` - Connects this stream to a source
- `disconnect(source)` - Disconnects this stream from a source
- `disconnectAll()` - Disconnects from all sources
- `isOpen` - Whether the stream is still open
- `onClose` - Signal triggered when the stream closes
- `onDone` - Signal triggered when all sources complete
- `onError` - Signal triggered when errors occur
- `close()` - Closes the stream and cleans up resources
- `map(fn)` - Creates a new stream by transforming each value
- `filter(predicate)` - Creates a new stream with only values that pass a test
- `take(count)` - Creates a stream with only the first n values
- `skip(count)` - Creates a stream that skips the first n values
- `pipe(target)` - Pipes values to another stream
- `next()` - Returns a promise that resolves with the next value
- `iterator()` - Creates an async iterator for the stream
- `[Symbol.asyncIterator]()` - Supports for-await-of loops

### SignalHub

- `signal(key)` - Gets a signal for a specific key
- `add(key, listener)` - Adds a listener for a specific key
- `remove(key, listener)` - Removes a listener for a specific key
- `on(key, listener)` - Alias for `add()` - adds a listener for a specific key
- `off(key, listener)` - Alias for `remove()` - removes a listener for a specific key
- `once(key, listener)` - Adds a one-time listener for a specific key
- `limit(key, listener, count)` - Adds a listener with a maximum trigger count
- `next(key)` - Returns a promise that resolves with the next value for a key
- `has(key, listener)` - Checks if a specific listener is registered for a key
- `size(key)` - Gets the number of listeners for a specific key
- `dispatch(key, value)` - Dispatches a value for a specific key
- `keys()` - Returns all registered keys
- `hasKey(key)` - Checks if a key has been accessed
- `clear(key)` - Clears all listeners for a specific key
- `clearAll()` - Clears all listeners for all keys
- `delete(key)` - Deletes a key and its associated signal

### Type Guards

- `isEventTarget(emitter)` - Checks if an object is a DOM EventTarget
- `isEventEmitter(emitter)` - Checks if an object is a Node.js-style EventEmitter
- `isNodeEventTarget(emitter)` - Checks if an object is a Node.js-style EventTarget

### Source Factory Functions

- `signalSource(...signals)` - Creates a source that emits values from one or more signals
- `streamSource(...streams)` - Creates a source that emits values from one or more streams
- `emitterSource(emitter)(eventName)` - Creates a source that emits values from an event emitter
- `eventTargetSource(target)(eventName, options)` - Creates a source that emits events from a DOM event target
- `asyncIterableSource(iterable)` - Creates a source that emits values from an async iterable
- `throttledIterableSource(iterable, delay)` - Creates a source that emits values from an iterable with a specified delay
- `promiseSource(promise)` - Creates a source that emits the resolved value of a promise and then completes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Libraries

The @moon7 ecosystem includes several complementary TypeScript libraries:

- [@moon7/async](https://github.com/moon7-io/moon7-async) - Utilities for asynchronous programming
- [@moon7/inspect](https://github.com/moon7-io/moon7-inspect) - Runtime type inspection and reflection
- [@moon7/result](https://github.com/moon7-io/moon7-result) - A Result monad for error handling

## License

MIT © [Munir Hussin](https://github.com/moon7-io)