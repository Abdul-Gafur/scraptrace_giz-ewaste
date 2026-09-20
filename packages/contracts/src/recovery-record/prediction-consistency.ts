import type { RefinementCtx } from "zod";

interface PredictionFields {
  readonly scores: readonly { readonly category: string; readonly score: number }[];
  readonly suggested_category: string;
  readonly confidence: number;
}

export const addPredictionConsistencyIssues = (
  value: PredictionFields,
  context: RefinementCtx,
) => {
  const selected = value.scores.find((score) => score.category === value.suggested_category);
  if (!selected || Math.abs(selected.score - value.confidence) > Number.EPSILON) {
    context.addIssue({ code: "custom", path: ["confidence"], message: "Confidence must equal the selected category score." });
  }
  const highest = Math.max(...value.scores.map((score) => score.score));
  if (!selected || selected.score < highest) {
    context.addIssue({ code: "custom", path: ["suggested_category"], message: "Suggested category must have a highest score." });
  }
};
