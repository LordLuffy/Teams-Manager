import { createContext, useContext, useState, type ReactNode } from "react";
import en from "./en";
import fr from "./fr";
import es from "./es";
import de from "./de";

export type Lang = "en" | "fr" | "es" | "de";

const locales: Record<Lang, typeof en> = { en, fr, es, de };

// ── Deep get via dot notation ─────────────────────────────────────────────────
function deepGet(obj: unknown, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj) as string | undefined;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("tm-language") ?? "en") as Lang
  );

  function setLang(l: Lang) {
    localStorage.setItem("tm-language", l);
    setLangState(l);
  }

  function t(key: string): string {
    const locale = locales[lang];
    return (
      deepGet(locale, key) ??
      deepGet(locales.en, key) ??
      key
    );
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
