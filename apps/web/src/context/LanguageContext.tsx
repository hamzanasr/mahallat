"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  SupportedLanguage,
  Direction,
  TranslationSchema,
  getTranslations,
  getDirection,
  isRTL,
} from "@mahallat/shared";

interface LanguageContextType {
  language: SupportedLanguage;
  direction: Direction;
  isRTL: boolean;
  t: TranslationSchema;
  toggleLanguage: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("ar");

  const direction = getDirection(language);
  const rtl = isRTL(language);
  const t = getTranslations(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));
  };

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        direction,
        isRTL: rtl,
        t,
        toggleLanguage,
        setLanguage,
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
