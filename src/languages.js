export const DEFAULT_LANGUAGE = 'id';

export const LANGUAGES = [
  { value: 'id', label: 'Indonesia', vocabFolder: 'Indonesian' },
  { value: 'en', label: 'English', vocabFolder: 'English' },
  { value: 'zh-Hans', label: '简体中文', vocabFolder: 'Chinese' },
];

export function normalizeLanguage(value) {
  return LANGUAGES.some((language) => language.value === value) ? value : DEFAULT_LANGUAGE;
}
