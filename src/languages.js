export const DEFAULT_LANGUAGE = 'id';

export const LANGUAGES = [
  { value: 'id', label: 'Indonesia', vocabFolder: 'Indonesian' },
  { value: 'en', label: 'English', vocabFolder: 'English' },
  { value: 'zh-Hans', label: '简体中文', vocabFolder: 'Chinese' },
  { value: 'tl', label: 'Tagalog', vocabFolder: 'Tagalog' },
  { value: 'vi', label: 'Tiếng Việt', vocabFolder: 'Vietnamese' },
];

export function normalizeLanguage(value) {
  return LANGUAGES.some((language) => language.value === value) ? value : DEFAULT_LANGUAGE;
}
