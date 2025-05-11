export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
