import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkExercise } from '../server/grader.ts';

const check = `// @test add returns a number
type _a = Expect<Equal<ReturnType<typeof add>, number>>;
// @test add rejects strings
// @ts-expect-error
add("1", 2);
`;
const good = 'function add(a: number, b: number) { return a + b; }\n';

test('passes correct code', () => {
  const result = checkExercise({ code: good, check });
  assert.equal(result.passed, true);
  assert.deepEqual(result.tests.map((t) => t.passed), [true, true]);
});

test('reports each failing test and learner diagnostics with positions', () => {
  const result = checkExercise({ code: 'function add(a, b) { return a + b; }\n', check });
  assert.equal(result.passed, false);
  assert.equal(result.diagnostics[0]?.line, 1);
  assert.equal(result.diagnostics[0]?.column, 14);
  assert.deepEqual(result.tests.map((t) => t.passed), [false, false]);
});

test('an unterminated comment cannot swallow the hidden tests', () => {
  const result = checkExercise({ code: `${good}/*`, check });
  assert.equal(result.passed, false);
});

for (const directive of ['@ts-ignore', '@ts-nocheck', '@ts-expect-error']) {
  test(`rejects ${directive} in learner code`, () => {
    const result = checkExercise({ code: `// ${directive}\n${good}`, check });
    assert.equal(result.passed, false);
    assert.match(result.diagnostics.map((d) => d.message).join(), /isn't allowed/);
  });
}

test('`any` cannot satisfy a type-equality test', () => {
  const result = checkExercise({ code: 'function add(a: any, b: any): any { return a + b; }\n', check });
  assert.equal(result.passed, false);
});

test('learner globals do not collide with the DOM lib', () => {
  const result = checkExercise({ code: `${good}const name = "Ada";\nconst status = 1;\n`, check });
  assert.equal(result.passed, true);
});

test('a broken import in the tests is reported as a setup error', () => {
  const result = checkExercise({
    code: 'export const a = 1;\n',
    check: `import { b } from "./main";\n// @test b exists\nb;\n`,
  });
  assert.equal(result.passed, false);
  assert.match(result.setupError ?? '', /no exported member/);
});

test('learner code cannot read files from the host through imports', () => {
  const result = checkExercise({ code: `import x from "/etc/hosts";\n${good}`, check });
  assert.equal(result.passed, false);
  assert.match(result.diagnostics[0]?.message ?? '', /Cannot find module/);
});
