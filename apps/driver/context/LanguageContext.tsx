import React, { createContext, useContext, useState, useEffect } from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SupportedLanguage,
  Direction,
  TranslationSchema,
  getTranslations,
  getDirection,
  isRTL as checkIsRTL,
  translate,
} from "@mahallat/shared";

export type CallableTranslation = TranslationSchema & ((path: string) => string);

interface LanguageContextType {
  lang: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: CallableTranslation;
  isRTL: boolean;
  dir: Direction;
}

const LANGUAGE_STORAGE_KEY = "@mahallat_driver_lang";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLanguage>("ar");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((savedLang) => {
      if (savedLang === "ar" || savedLang === "en") {
        setLangState(savedLang);
        applyRTL(savedLang);
      }
    });
  }, []);

  const applyRTL = (newLang: SupportedLanguage) => {
    const isTargetRTL = checkIsRTL(newLang);
    if (I18nManager.isRTL !== isTargetRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(isTargetRTL);
    }
  };

  const setLanguage = async (newLang: SupportedLanguage) => {
    setLangState(newLang);
    applyRTL(newLang);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
  };

  const toggleLanguage = async () => {
    const nextLang: SupportedLanguage = lang === "ar" ? "en" : "ar";
    await setLanguage(nextLang);
  };

  const rawT = getTranslations(lang);
  const tCallable = ((path: string) => translate(lang, path)) as CallableTranslation;
  Object.assign(tCallable, rawT);

  const isRTL = checkIsRTL(lang);
  const dir = getDirection(lang);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLanguage,
        toggleLanguage,
        t: tCallable,
        isRTL,
        dir,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
