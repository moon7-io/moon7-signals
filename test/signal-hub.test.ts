import { expect, test, describe, vi, beforeEach } from "vitest";
import { SignalHub } from "~/index";

describe("SignalHub", () => {
    interface TestEvents {
        count: number;
        message: string;
        complete: void;
    }

    let hub: SignalHub<TestEvents>;

    beforeEach(() => {
        hub = new SignalHub<TestEvents>();
    });

    test("dispatch and receive events", () => {
        const countListener = vi.fn();
        const messageListener = vi.fn();
        const completeListener = vi.fn();

        hub.on("count", countListener);
        hub.on("message", messageListener);
        hub.on("complete", completeListener);

        hub.dispatch("count", 42);
        hub.dispatch("message", "hello");
        hub.dispatch("complete");

        expect(countListener).toHaveBeenCalledWith(42);
        expect(messageListener).toHaveBeenCalledWith("hello");
        expect(completeListener).toHaveBeenCalled();
    });

    test("signal method returns the same signal instance for the same key", () => {
        const signal1 = hub.signal("count");
        const signal2 = hub.signal("count");

        expect(signal1).toBe(signal2);
    });

    test("add and remove listeners", () => {
        const listener = vi.fn();

        hub.add("count", listener);
        hub.dispatch("count", 1);
        expect(listener).toHaveBeenCalledWith(1);

        hub.remove("count", listener);
        hub.dispatch("count", 2);
        expect(listener).toHaveBeenCalledTimes(1); // Still only once
    });

    test("on and off (aliases for add and remove)", () => {
        const listener = vi.fn();

        hub.on("count", listener);
        hub.dispatch("count", 1);
        expect(listener).toHaveBeenCalledWith(1);

        hub.off("count", listener);
        hub.dispatch("count", 2);
        expect(listener).toHaveBeenCalledTimes(1); // Still only once
    });

    test("once", () => {
        const listener = vi.fn();

        hub.once("count", listener);

        hub.dispatch("count", 1);
        hub.dispatch("count", 2);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(1);
    });

    test("limit", () => {
        const listener = vi.fn();

        hub.limit("count", listener, 2);

        hub.dispatch("count", 1);
        hub.dispatch("count", 2);
        hub.dispatch("count", 3);

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith(1);
        expect(listener).toHaveBeenCalledWith(2);
    });

    test("next", async () => {
        const promise = hub.next("message");
        hub.dispatch("message", "async message");

        const result = await promise;
        expect(result).toBe("async message");
    });

    test("has", () => {
        const listener = vi.fn();

        expect(hub.has("count", listener)).toBe(false);

        hub.on("count", listener);
        expect(hub.has("count", listener)).toBe(true);

        hub.off("count", listener);
        expect(hub.has("count", listener)).toBe(false);
    });

    test("size", () => {
        expect(hub.size("count")).toBe(0);

        const listener1 = vi.fn();
        const listener2 = vi.fn();

        hub.on("count", listener1);
        expect(hub.size("count")).toBe(1);

        hub.on("count", listener2);
        expect(hub.size("count")).toBe(2);

        hub.off("count", listener1);
        expect(hub.size("count")).toBe(1);

        hub.clear("count");
        expect(hub.size("count")).toBe(0);
    });

    test("clear", () => {
        const countListener = vi.fn();
        const messageListener = vi.fn();

        hub.on("count", countListener);
        hub.on("message", messageListener);

        hub.clear("count");

        hub.dispatch("count", 1);
        hub.dispatch("message", "test");

        expect(countListener).not.toHaveBeenCalled();
        expect(messageListener).toHaveBeenCalled();
    });

    test("clearAll", () => {
        const countListener = vi.fn();
        const messageListener = vi.fn();

        hub.on("count", countListener);
        hub.on("message", messageListener);

        hub.clearAll();

        hub.dispatch("count", 1);
        hub.dispatch("message", "test");

        expect(countListener).not.toHaveBeenCalled();
        expect(messageListener).not.toHaveBeenCalled();
    });

    test("keys", () => {
        // Access some signals to register them
        hub.signal("count");
        hub.signal("message");

        const keys = Array.from(hub.keys());
        expect(keys).toHaveLength(2);
        expect(keys).toContain("count");
        expect(keys).toContain("message");
    });

    test("hasKey", () => {
        expect(hub.hasKey("count")).toBe(false);

        hub.signal("count");
        expect(hub.hasKey("count")).toBe(true);
    });

    test("delete", () => {
        hub.signal("count");
        expect(hub.hasKey("count")).toBe(true);

        const result = hub.delete("count");
        expect(result).toBe(true);
        expect(hub.hasKey("count")).toBe(false);

        // Deleting non-existent key
        const result2 = hub.delete("count");
        expect(result2).toBe(false);
    });

    test("multiple listeners for the same event", () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        hub.on("count", listener1);
        hub.on("count", listener2);

        hub.dispatch("count", 42);

        expect(listener1).toHaveBeenCalledWith(42);
        expect(listener2).toHaveBeenCalledWith(42);
    });

    test("different events don't interfere", () => {
        const countListener = vi.fn();
        const messageListener = vi.fn();

        hub.on("count", countListener);
        hub.on("message", messageListener);

        hub.dispatch("count", 42);

        expect(countListener).toHaveBeenCalledWith(42);
        expect(messageListener).not.toHaveBeenCalled();
    });
});
