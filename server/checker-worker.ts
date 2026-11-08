import { parentPort } from 'node:worker_threads';
import { checkExercise, type CheckInput } from './grader.ts';

if (!parentPort) throw new Error('checker-worker must run in a worker thread');
const port = parentPort;

// Warm the compiler and lib cache so the first learner request isn't slow.
checkExercise({ code: 'const ready = true;', check: '' });
port.postMessage({ type: 'ready' });

port.on('message', (job: { id: number; input: CheckInput }) => {
  port.postMessage({ type: 'result', id: job.id, result: checkExercise(job.input) });
});
