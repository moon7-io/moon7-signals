import { expect, test, describe } from "vitest";
import {
    isEventTarget,
    isEventEmitter,
    isNodeEventTarget,
    type EventTarget,
    type EventEmitter,
    type NodeEventEmitter,
} from "~/emitters";

describe("Emitters type guards", () => {
    describe("isEventTarget", () => {
        test("returns true for objects implementing EventTarget interface", () => {
            const target: EventTarget<any> = {
                addEventListener: () => {},
                removeEventListener: () => {},
            };

            expect(isEventTarget(target)).toBe(true);
        });

        test("returns false for objects not implementing EventTarget interface", () => {
            const nonTarget = {
                on: () => {},
                off: () => {},
            };

            expect(isEventTarget(nonTarget)).toBe(false);
        });

        test("returns false for objects with only one EventTarget method", () => {
            const partialTarget = {
                addEventListener: () => {},
            };

            expect(isEventTarget(partialTarget)).toBe(false);
        });
    });

    describe("isEventEmitter", () => {
        test("returns true for objects implementing EventEmitter interface", () => {
            const emitter: EventEmitter<any> = {
                on: () => {},
                off: () => {},
            };

            expect(isEventEmitter(emitter)).toBe(true);
        });

        test("returns false for objects not implementing EventEmitter interface", () => {
            const nonEmitter = {
                addEventListener: () => {},
                removeEventListener: () => {},
            };

            expect(isEventEmitter(nonEmitter)).toBe(false);
        });

        test("returns false for objects with only one EventEmitter method", () => {
            const partialEmitter = {
                on: () => {},
            };

            expect(isEventEmitter(partialEmitter)).toBe(false);
        });
    });

    describe("isNodeEventTarget", () => {
        test("returns true for objects implementing NodeEventEmitter interface", () => {
            const nodeEmitter: NodeEventEmitter<any> = {
                addListener: () => {},
                removeListener: () => {},
            };

            expect(isNodeEventTarget(nodeEmitter)).toBe(true);
        });

        test("returns false for objects not implementing NodeEventEmitter interface", () => {
            const nonNodeEmitter = {
                on: () => {},
                off: () => {},
            };

            expect(isNodeEventTarget(nonNodeEmitter)).toBe(false);
        });

        test("returns false for objects with only one NodeEventEmitter method", () => {
            const partialNodeEmitter = {
                addListener: () => {},
            };

            expect(isNodeEventTarget(partialNodeEmitter)).toBe(false);
        });
    });
});
