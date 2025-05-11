export interface EventListenerOptions {
    capture?: boolean;
}

export interface AddEventListenerOptions extends EventListenerOptions {
    once?: boolean;
    passive?: boolean;
    // signal?: any;
}

export interface EventTarget<S> {
    addEventListener<K extends keyof S>(
        name: K,
        handler: EventHandler<S[K]>,
        options?: AddEventListenerOptions | boolean
    ): void;
    removeEventListener<K extends keyof S>(
        name: K,
        handler: EventHandler<S[K]>,
        options?: EventListenerOptions | boolean
    ): void;
}

export interface EventEmitter<S> {
    on<K extends keyof S>(name: K, handler: EventHandler<S[K]>): void;
    off<K extends keyof S>(name: K, handler: EventHandler<S[K]>): void;
}

export interface NodeEventEmitter<S> {
    addListener<K extends keyof S>(name: K, handler: EventHandler<S[K]>): void;
    removeListener<K extends keyof S>(name: K, handler: EventHandler<S[K]>): void;
}

export interface EventEmitterDispatch<T> extends EventEmitter<T> {
    emit(name: string, event: T): void;
}

export interface NodeEventEmitterDispatch<T> extends NodeEventEmitter<T> {
    dispatch(name: string, event: T): void;
}

export type EventHandler<T> = (event: T) => void;

export type Emitter<T> = EventEmitter<T> | NodeEventEmitter<T> | EventTarget<T>;

export function isEventTarget<T>(emitter: any): emitter is EventTarget<T> {
    return typeof emitter.addEventListener === "function" && typeof emitter.removeEventListener === "function";
}

export function isEventEmitter<T>(emitter: any): emitter is EventEmitter<T> {
    return typeof emitter.on === "function" && typeof emitter.off === "function";
}

export function isNodeEventTarget<T>(emitter: any): emitter is NodeEventEmitter<T> {
    return typeof emitter.addListener === "function" && typeof emitter.removeListener === "function";
}
