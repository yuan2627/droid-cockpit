import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["zh", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function detectInitialLocale(): AppLocale {
  if (typeof localStorage === "undefined") return "zh";
  const stored = localStorage.getItem("droid-cockpit-locale");
  if (stored === "zh" || stored === "en") return stored;
  return "zh";
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectInitialLocale(),
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
});

export function changeLocale(locale: AppLocale): void {
  i18n.changeLanguage(locale);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("droid-cockpit-locale", locale);
  }
}

export function getCurrentLocale(): AppLocale {
  const lng = i18n.language;
  return lng === "en" ? "en" : "zh";
}

export default i18n;
