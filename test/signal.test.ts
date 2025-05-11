import { expect, test, describe, vi, beforeEach } from "vitest";
import { Signal } from "~/index";

describe("Signal", () => {
    let signal: Signal<string>;

    beforeEach(() => {
        signal = new Signal<string>();
    });

    test("add and dispatch", () => {
        const listener = vi.fn();
        signal.add(listener);

        signal.dispatch("hello");
        expect(listener).toHaveBeenCalledWith("hello");

        signal.dispatch("world");
        expect(listener).toHaveBeenCalledWith("world");
        expect(listener).toHaveBeenCalledTimes(2);
    });

    test("remove", () => {
        const listener = vi.fn();
        signal.add(listener);

        signal.dispatch("first");
        expect(listener).toHaveBeenCalledTimes(1);

        signal.remove(listener);
        signal.dispatch("second");
        expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test("returned remove function", () => {
        const listener = vi.fn();
        const remove = signal.add(listener);

        signal.dispatch("first");
        expect(listener).toHaveBeenCalledTimes(1);

        remove();
        signal.dispatch("second");
        expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test("once", () => {
        const listener = vi.fn();
        signal.once(listener);

        signal.dispatch("first");
        expect(listener).toHaveBeenCalledTimes(1);

        signal.dispatch("second");
        expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test("limit", () => {
        const listener = vi.fn();
        signal.limit(listener, 3);

        signal.dispatch("one");
        signal.dispatch("two");
        signal.dispatch("three");
        expect(listener).toHaveBeenCalledTimes(3);

        signal.dispatch("four");
        expect(listener).toHaveBeenCalledTimes(3); // Still 3, not called again
    });

    test("next", async () => {
        const promise = signal.next();
        signal.dispatch("async value");

        const result = await promise;
        expect(result).toBe("async value");
    });

    test("clear", () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        signal.add(listener1);
        signal.add(listener2);

        signal.clear();
        signal.dispatch("after clear");

        expect(listener1).not.toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
    });

    test("has", () => {
        const listener = vi.fn();

        expect(signal.has(listener)).toBe(false);

        signal.add(listener);
        expect(signal.has(listener)).toBe(true);

        signal.remove(listener);
        expect(signal.has(listener)).toBe(false);
    });

    test("size", () => {
        expect(signal.size).toBe(0);

        const listener1 = vi.fn();
        const listener2 = vi.fn();

        signal.add(listener1);
        expect(signal.size).toBe(1);

        signal.add(listener2);
        expect(signal.size).toBe(2);

        signal.remove(listener1);
        expect(signal.size).toBe(1);

        signal.clear();
        expect(signal.size).toBe(0);
    });

    test("multiple listeners", () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        signal.add(listener1);
        signal.add(listener2);

        signal.dispatch("multi");

        expect(listener1).toHaveBeenCalledWith("multi");
        expect(listener2).toHaveBeenCalledWith("multi");
    });

    test("error in listener doesn't affect other listeners", () => {
        const errorListener = vi.fn().mockImplementation(() => {
            throw new Error("listener error");
        });
        const goodListener = vi.fn();

        signal.add(errorListener);
        signal.add(goodListener);

        // This should not throw
        signal.dispatch("test");

        expect(errorListener).toHaveBeenCalled();
        expect(goodListener).toHaveBeenCalled();
    });
});
