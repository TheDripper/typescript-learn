// Runs the type-checker on a worker thread. Types can be made arbitrarily
// expensive, so a job that overruns has its worker killed and replaced.
import { Worker } from 'node:worker_threads';
import type { CheckResult } from '../shared/types.ts';
import type { CheckInput } from './grader.ts';

const TIMEOUT_MS = 8_000;
const MAX_QUEUE = 64;

interface Job {
  id: number;
  input: CheckInput;
  resolve: (result: CheckResult) => void;
}

const abandoned = (message: string): CheckResult => ({
  passed: false,
  diagnostics: [],
  tests: [],
  setupError: message,
  timedOut: true,
});

export class QueueFullError extends Error {}

export class Checker {
  private worker!: Worker;
  private ready = false;
  private closed = false;
  private queue: Job[] = [];
  private current: Job | null = null;
  private timer: NodeJS.Timeout | null = null;
  private nextId = 1;

  constructor() {
    this.spawn();
  }

  private spawn() {
    this.ready = false;
    const worker = new Worker(new URL('./checker-worker.ts', import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: 768 },
    });
    this.worker = worker;
    worker.on('message', (message: { type: 'ready' } | { type: 'result'; id: number; result: CheckResult }) => {
      if (worker !== this.worker) return;
      if (message.type === 'ready') {
        this.ready = true;
      } else if (this.current?.id === message.id) {
        this.finish(message.result);
      }
      this.pump();
    });
    const replace = (reason: string) => {
      if (worker !== this.worker || this.closed) return;
      this.finish(abandoned(reason));
      this.spawn();
    };
    worker.on('error', () => replace('The type-checker ran out of resources on this code.'));
    worker.on('exit', () => replace('The type-checker stopped unexpectedly.'));
  }

  private finish(result: CheckResult) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current?.resolve(result);
    this.current = null;
  }

  private pump() {
    if (!this.ready || this.current) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    this.worker.postMessage({ id: job.id, input: job.input });
    this.timer = setTimeout(() => {
      this.finish(abandoned('Type-checking took too long. Look for a very deep or recursive type.'));
      const stale = this.worker;
      this.spawn();
      void stale.terminate();
    }, TIMEOUT_MS);
  }

  run(input: CheckInput): Promise<CheckResult> {
    if (this.queue.length >= MAX_QUEUE) return Promise.reject(new QueueFullError());
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, input, resolve });
      this.pump();
    });
  }

  async close() {
    this.closed = true;
    await this.worker.terminate();
  }
}
