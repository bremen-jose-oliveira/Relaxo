import { getLocales } from 'expo-localization';
import { en, type TranslationDict } from './locales/en';
import { de } from './locales/de';
import type { AppLocale } from '@/types';

const dictionaries: Record<'en' | 'de', TranslationDict> = { en, de };

export function resolveLocale(setting: AppLocale): 'en' | 'de' {
  if (setting === 'en' || setting === 'de') return setting;
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'de' ? 'de' : 'en';
}

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(
  key: string,
  locale: 'en' | 'de',
  params?: Record<string, string | number>
): string {
  const template = getNested(dictionaries[locale] as unknown as Record<string, unknown>, key)
    ?? getNested(en as unknown as Record<string, unknown>, key)
    ?? key;

  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [k, v]) => text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    template
  );
}

export function useTranslation(localeSetting: AppLocale) {
  const locale = resolveLocale(localeSetting);
  return (key: string, params?: Record<string, string | number>) =>
    translate(key, locale, params);
}
