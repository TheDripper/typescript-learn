import { createGrader, type CheckInput } from '../shared/grader-core.ts';

fetch('/tslib.json')
  .then((response) => {
    if (!response.ok) throw new Error(`tslib.json: ${response.status}`);
    return response.json() as Promise<Record<string, string>>;
  })
  .then((libs) => {
    const { checkExercise } = createGrader({
      libDir: '/lib',
      isLib: (fileName) => fileName.startsWith('/lib/'),
      read: (fileName) => libs[fileName.slice('/lib/'.length)],
    });
    self.onmessage = (event: MessageEvent<{ id: number; input: CheckInput }>) => {
      self.postMessage({ type: 'result', id: event.data.id, result: checkExercise(event.data.input) });
    };
    self.postMessage({ type: 'ready' });
  })
  .catch(() => self.postMessage({ type: 'failed' }));
