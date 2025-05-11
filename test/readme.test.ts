import { expect, describe, test } from "vitest";
import { asyncIterableSource } from "~/factories";
import { consume, Source, toAsyncIterable } from "~/source";
import { Stream } from "~/stream";

describe("Bufferedd", () => {
    const numberSource: Source<number> = (emit, done) => {
        for (let i = 0; i < 5; i++) {
            emit(i);
        }
        done();
    };

    test("early emissions will fail", async () => {
        // These values are emitted before any listeners are attached
        const stream = Stream.of<number>(numberSource);

        // This listener is added too late and won't receive the values
        const values: number[] = [];
        stream.add(value => values.push(value));
        expect(values).toEqual([]);
    });

    test("connect later", async () => {
        // These values are emitted before any listeners are attached
        const stream = new Stream<number>();

        // This listener is added too late and won't receive the values
        const values: number[] = [];
        stream.add(value => values.push(value));
        stream.connect(numberSource);
        expect(values).toEqual([0, 1, 2, 3, 4]);
    });

    test("toAsyncIterable allows pulling out values", async () => {
        const iter = toAsyncIterable<number>(numberSource);

        const values: number[] = [];
        for await (const value of iter) {
            values.push(value);
        }
        expect(values).toEqual([0, 1, 2, 3, 4]);
    });

    test.skip("asyncIterableSource", async () => {
        const source = asyncIterableSource(toAsyncIterable<number>(numberSource));

        const values: number[] = [];
        consume(source, value => values.push(value));
        expect(values).toEqual([0, 1, 2, 3, 4]);
    });
});
