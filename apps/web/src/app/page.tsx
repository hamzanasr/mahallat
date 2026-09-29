"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function HomePage() {
  const { t, toggleLanguage, direction } = useLanguage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center transition-all">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium mb-6 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{t.home.status}</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          {t.common.appName}
        </h1>

        <p className="text-sm font-medium text-slate-500 mb-6">
          {t.common.tagline}
        </p>

        <div className="h-px bg-slate-100 my-6" />

        <h2 className="text-lg font-semibold text-slate-800 mb-2">
          {t.home.welcome}
        </h2>

        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
          {t.home.description}
        </p>

        <button
          onClick={toggleLanguage}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl transition duration-150 ease-in-out shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🌐</span>
          <span>{t.common.switchLanguage}</span>
        </button>

        <div className="mt-6 text-xs text-slate-400">
          Direction: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{direction}</code>
        </div>
      </div>
    </main>
  );
}
