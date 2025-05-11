export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function timeout<T = void>(ms: number) {
    return new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}
