import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../translations';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'bm',
  setLang: () => {},
  t: (key) => translations.bm[key] as string,
});

const LANG_KEY = 'app_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('bm');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'bm' || saved === 'en') setLangState(saved);
    });
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  };

  const t = (key: TranslationKey): string =>
    (translations[lang][key] as string) ?? (translations.bm[key] as string);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
