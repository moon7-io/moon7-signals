import { Signal } from "./signal";
import { Abort, consume, Done, Source, toCallback } from "./source";

export class Stream<T> extends Signal<T> {
    private readonly connections = new Map<Source<T>, Abort>();
    public readonly onError = new Signal<any>();
    public readonly onDone = new Signal<void>();
    public readonly onClose = new Signal<void>();
    private _isOpen = true;

    public constructor() {
        super();
    }

    public static of<T>(source: Source<T>): Stream<T> {
        const stream = new Stream<T>();
        stream.connect(source);
        return stream;
    }

    public get isOpen(): boolean {
        return this._isOpen;
    }

    public connect(source: Source<T>): Stream<T> {
        if (this.connections.has(source)) {
            throw new Error("Source already connected");
        }
        const onDone: Done = () => {
            this.disconnect(source);
            this.onDone.dispatch();
            if (this.connections.size === 0) {
                this.close();
            }
        };
        const abort = consume(source, toCallback(this), onDone, toCallback(this.onError));
        this.connections.set(source, abort);
        return this;
    }

    public disconnect(source: Source<T>): boolean {
        const kill = this.connections.get(source);
        kill?.();
        return this.connections.delete(source);
    }

    public disconnectAll(): void {
        this.connections.forEach((abort) => abort());
        this.connections.clear();
    }

    public close(): void {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.disconnectAll();
        this.onDone.dispatch();
        this.onClose.dispatch();
    }

    public override dispatch(value: T): void {
        if (!this._isOpen) return;
        for (const slot of Array.from(this.slots)) {
            try {
                slot(value);
            } catch (error) {
                this.onError.dispatch(error);
            }
        }
    }

    public override next(): Promise<T> {
        return new Promise<T>((pass, fail) => {
            if (!this._isOpen) {
                return fail(new Error("Stream is closed"));
            }
            this.onClose.once(fail);
            this.once(pass);
        });
    }

    public async *iterator(): AsyncGenerator<T> {
        while (this._isOpen) {
            try {
                yield await this.next();
            } catch (_error) {
                // stream closed
                return;
            }
        }
    }

    public [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this.iterator();
    }

    public pipe(target: Stream<T>): Stream<T> {
        const remove = this.add((value) => target.dispatch(value));
        target.onClose.once(() => remove());
        return target;
    }

    public map<U>(fn: (value: T) => U): Stream<U> {
        return Stream.of<U>((emit) => this.add((value) => emit(fn(value))));
    }

    public filter(predicate: (value: T) => boolean): Stream<T> {
        return Stream.of<T>((emit) => {
            return this.add((value) => {
                if (predicate(value)) {
                    emit(value);
                }
            });
        });
    }

    public take(count: number): Stream<T> {
        return Stream.of<T>((emit, done) => {
            let remaining = count;
            return this.add((value) => {
                emit(value);
                if (--remaining <= 0) done();
            });
        });
    }

    public skip(count: number): Stream<T> {
        return Stream.of<T>((emit) => {
            let skipped = 0;
            return this.add((value) => {
                if (skipped++ < count) return;
                emit(value);
            });
        });
    }
}
