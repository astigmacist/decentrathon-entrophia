import { useI18nStore } from '@/store/i18n-store';
import en from './en';
import ru from './ru';

const dictionaries = {
  en,
  ru,
};

type Dictionary = typeof en;

export function useTranslation() {
  const lang = useI18nStore((state) => state.lang);
  const t = (key: string) => {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = dictionaries[lang];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Fallback to key if not found
      }
    }
    return value as string;
  };
  return { t, lang };
}
