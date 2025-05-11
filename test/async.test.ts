import { expect, describe, test } from "vitest";
import { sleep, timeout } from "~/async";

describe("Async utilities", () => {
    test("sleep returns a promise that resolves after the specified time", async () => {
        const start = Date.now();
        await sleep(50);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing flexibility
    });

    test("timeout returns a promise that rejects after the specified time", async () => {
        const timeoutPromise = timeout(50);
        await expect(timeoutPromise).rejects.toThrow("timeout");
    });
});
