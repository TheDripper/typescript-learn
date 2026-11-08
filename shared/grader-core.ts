// Grades learner code by type-checking it with the TypeScript compiler.
// Learner code is only ever parsed and type-checked, never executed.
// Runs in Node (server/grader.ts) and in a browser worker (client/check.worker.ts).
import ts from 'typescript';
import type { CheckResult, Diagnostic } from './types.ts';

export interface CheckInput {
  code: string;
  check: string;
  support?: { name: string; code: string }[];
}

/** Where the compiler finds TypeScript's own lib.*.d.ts files. */
export interface LibHost {
  libDir: string;
  isLib(fileName: string): boolean;
  read(fileName: string): string | undefined;
}

const MAIN = '/main.ts';
const CHECK = '/__check.ts';
const HELPERS = '/__helpers.d.ts';

const TEST_HELPERS = `
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
`;

// Exercises run without the DOM lib so that learner globals such as `name`
// don't collide with window properties. These cover what lessons print.
const EXERCISE_GLOBALS = `
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void };
declare function setTimeout(callback: () => void, ms?: number): number;
`;

const BANNED_DIRECTIVE = /@ts-(ignore|nocheck|expect-error)\b/;

const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  types: [],
};

const message = (d: ts.Diagnostic) => ts.flattenDiagnosticMessageText(d.messageText, '\n');

/** Splits hidden test code on `// @test label` comments, returning each label and its starting line. */
export function parseTests(check: string): { label: string; line: number }[] {
  const tests: { label: string; line: number }[] = [];
  check.split('\n').forEach((text, line) => {
    const match = /^\s*\/\/\s*@test\s+(.+?)\s*$/.exec(text);
    if (match?.[1]) tests.push({ label: match[1], line });
  });
  return tests;
}

export function createGrader(libs: LibHost) {
  // Parsed library files are by far the most expensive input, so they're reused.
  const libCache = new Map<string, ts.SourceFile | undefined>();

  function typeCheck(files: Map<string, string>, lib: string[]): readonly ts.Diagnostic[] {
    const host: ts.CompilerHost = {
      getSourceFile(fileName, languageVersion) {
        const text = files.get(fileName);
        if (text !== undefined) return ts.createSourceFile(fileName, text, languageVersion, true);
        if (!libs.isLib(fileName)) return undefined;
        if (!libCache.has(fileName)) {
          const source = libs.read(fileName);
          libCache.set(fileName, source === undefined ? undefined : ts.createSourceFile(fileName, source, languageVersion, true));
        }
        return libCache.get(fileName);
      },
      getDefaultLibFileName: () => `${libs.libDir}/lib.d.ts`,
      getDefaultLibLocation: () => libs.libDir,
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (fileName) => files.has(fileName) || (libs.isLib(fileName) && libs.read(fileName) !== undefined),
      readFile: (fileName) => files.get(fileName) ?? (libs.isLib(fileName) ? libs.read(fileName) : undefined),
      directoryExists: (dir) => dir === '/' || libs.isLib(`${dir}/x`),
      getDirectories: () => [],
    };
    const program = ts.createProgram([...files.keys()], { ...options, lib }, host);
    return ts.getPreEmitDiagnostics(program);
  }

  function checkExercise({ code, check, support = [] }: CheckInput): CheckResult {
    const files = new Map<string, string>([
      [MAIN, code],
      // A separate file, so an unterminated comment in learner code can't swallow the tests.
      [CHECK, check],
      [HELPERS, TEST_HELPERS + EXERCISE_GLOBALS],
    ]);
    for (const file of support) files.set(`/${file.name}`, file.code);

    const diagnostics = typeCheck(files, ['lib.es2022.d.ts']);
    const tests = parseTests(check);
    const failed = new Set<number>();
    const learner: Diagnostic[] = [];
    let setupError: string | undefined;

    for (const d of diagnostics) {
      if (d.file?.fileName === MAIN && d.start !== undefined) {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        learner.push({
          from: d.start,
          to: d.start + (d.length ?? 1),
          line: line + 1,
          column: character + 1,
          message: message(d),
        });
      } else if (d.file?.fileName === CHECK && d.start !== undefined) {
        const line = d.file.getLineAndCharacterOfPosition(d.start).line;
        let owner = -1;
        tests.forEach((test, i) => {
          if (test.line <= line) owner = i;
        });
        if (owner >= 0) failed.add(owner);
        else setupError ??= message(d);
      } else {
        setupError ??= message(d);
      }
    }

    const banned = BANNED_DIRECTIVE.exec(code);
    if (banned) {
      learner.push({
        from: banned.index,
        to: banned.index + banned[0].length,
        line: code.slice(0, banned.index).split('\n').length,
        column: banned.index - code.lastIndexOf('\n', banned.index),
        message: `${banned[0]} isn't allowed in exercises. Fix the type error instead of silencing it.`,
      });
    }

    learner.sort((a, b) => a.from - b.from);
    return {
      passed: learner.length === 0 && failed.size === 0 && setupError === undefined,
      diagnostics: learner,
      tests: tests.map((test, i) => ({ label: test.label, passed: !failed.has(i) && setupError === undefined })),
      ...(setupError === undefined ? {} : { setupError }),
    };
  }

  /** Type-checks a standalone lesson example and returns the 1-based lines that have errors. */
  function errorLines(snippet: string): { line: number; message: string }[] {
    const files = new Map([[MAIN, `${snippet}\nexport {};\n`]]);
    return typeCheck(files, ['lib.es2022.d.ts', 'lib.dom.d.ts']).map((d) => ({
      line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0,
      message: message(d),
    }));
  }

  return { checkExercise, errorLines };
}
