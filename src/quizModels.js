export const DEFAULT_QUIZ_MODEL = 'claude-sonnet-5-5';

export const QUIZ_MODELS = [
  { value: DEFAULT_QUIZ_MODEL, labelKey: 'modelSonnetLabel' },
  { value: 'claude-opus-4-7', labelKey: 'modelOpusLabel' },
  { value: 'claude-haiku-4-5-20251001', labelKey: 'modelHaikuLabel' },
];

export function isSupportedQuizModel(model) {
  return QUIZ_MODELS.some((item) => item.value === model);
}
