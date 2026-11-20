export const DEFAULT_QUIZ_MODEL = 'claude-sonnet-5-5';
const OPUS_MODEL = 'claude-opus-5-5';
const HAIKU_MODEL = 'claude-haiku-5-5';

export const QUIZ_MODELS = [
  { value: DEFAULT_QUIZ_MODEL, labelKey: 'modelSonnetLabel', thinking: 'between_tools', effort: 'high' },
  { value: OPUS_MODEL, labelKey: 'modelOpusLabel', thinking: 'adaptive', effort: 'low' },
  { value: HAIKU_MODEL, labelKey: 'modelHaikuLabel', thinking: 'disabled', effort: 'medium' },
];

const LEGACY_MODEL_IDS = new Map([
  ['claude-sonnet-4-6', DEFAULT_QUIZ_MODEL],
  ['claude-opus-4-7', OPUS_MODEL],
  ['claude-haiku-4-5-20251001', HAIKU_MODEL],
]);

export function migrateQuizModelId(model) {
  return LEGACY_MODEL_IDS.get(model) ?? model;
}

export function isSupportedQuizModel(model) {
  return QUIZ_MODELS.some((item) => item.value === model);
}
