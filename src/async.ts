export function sleep(ms: number): Promise<void>;
export function sleep<T>(ms: number, value: T): Promise<T>;
export function sleep<T>(ms: number, value?: T): Promise<T> {
    return new Promise(pass => setTimeout(() => pass(value as T), ms));
}

export function timeout<T = void>(ms: number, error?: any): Promise<T> {
    return new Promise((_, fail) => setTimeout(() => fail(error ?? new Error("timeout")), ms));
}
