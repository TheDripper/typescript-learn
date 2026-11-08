import type { QuizResult } from './types.ts';

export interface GradableQuiz {
  questions: { choices: { correct: boolean }[]; whyHtml: string }[];
}

export function gradeQuiz(quiz: GradableQuiz, answers: number[][]): QuizResult {
  const questions = quiz.questions.map((question, i) => {
    const correctChoices = question.choices.flatMap((choice, index) => (choice.correct ? [index] : []));
    const given = [...new Set(answers[i] ?? [])].sort((a, b) => a - b);
    return {
      correct: given.length === correctChoices.length && given.every((choice, k) => choice === correctChoices[k]),
      correctChoices,
      whyHtml: question.whyHtml,
    };
  });
  const score = questions.filter((q) => q.correct).length / questions.length;
  return { passed: score === 1, score, questions };
}
