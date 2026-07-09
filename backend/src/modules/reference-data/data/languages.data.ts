export interface LanguageOption {
  code: string;
  name: string;
}

/**
 * Common languages by ISO 639-1 code. Not an ISO *country* dataset, so
 * hand-maintaining this (unlike countries) is acceptable — there's no
 * single authoritative "which languages does a business app support"
 * list, and this covers every language likely to matter for Voltx's
 * current and near-term markets.
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ms', name: 'Malay' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'bn', name: 'Bengali' },
  { code: 'fa', name: 'Persian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'el', name: 'Greek' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'cs', name: 'Czech' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'tl', name: 'Filipino' },
];
