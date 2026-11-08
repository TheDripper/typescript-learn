// The compiler-backed grader, reading TypeScript's lib files from node_modules.
import path from 'node:path';
import ts from 'typescript';
import { createGrader } from '../shared/grader-core.ts';

export { parseTests, type CheckInput } from '../shared/grader-core.ts';

const LIB_DIR = path.dirname(ts.getDefaultLibFilePath({}));

export const { checkExercise, errorLines } = createGrader({
  libDir: LIB_DIR,
  isLib: (fileName) => path.normalize(fileName).startsWith(LIB_DIR + path.sep),
  read: (fileName) => ts.sys.readFile(fileName),
});
