import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { dropDetectedLanguageIfSystem } from "./language-choice";

// 각 언어별 네임스페이스 import
import koCommon from "@/locales/ko/common.json";
import koLayout from "@/locales/ko/layout.json";
import koTodo from "@/locales/ko/todo.json";
import koCalendar from "@/locales/ko/calendar.json";
import koMemo from "@/locales/ko/memo.json";
import koTimer from "@/locales/ko/timer.json";
import koExpense from "@/locales/ko/expense.json";
import koBudget from "@/locales/ko/budget.json";
import koCard from "@/locales/ko/card.json";
import koCategory from "@/locales/ko/category.json";
import koAsset from "@/locales/ko/asset.json";
import koDashboard from "@/locales/ko/dashboard.json";
import koDutchPay from "@/locales/ko/dutchPay.json";
import koNotification from "@/locales/ko/notification.json";
import koLogin from "@/locales/ko/login.json";
import koUser from "@/locales/ko/user.json";
import koExport from "@/locales/ko/export.json";
import koSettings from "@/locales/ko/settings.json";
import koStocks from "@/locales/ko/stocks.json";
import koDownload from "@/locales/ko/download.json";
import koStats from "@/locales/ko/stats.json";
import koMore from "@/locales/ko/more.json";
import koRecurring from "@/locales/ko/recurring.json";
import koSubscription from "@/locales/ko/subscription.json";
import koDate from "@/locales/ko/date.json";
import koConstellation from "@/locales/ko/constellation.json";
import koDs from "@/locales/ko/ds.json";

import enCommon from "@/locales/en/common.json";
import enLayout from "@/locales/en/layout.json";
import enTodo from "@/locales/en/todo.json";
import enCalendar from "@/locales/en/calendar.json";
import enMemo from "@/locales/en/memo.json";
import enTimer from "@/locales/en/timer.json";
import enExpense from "@/locales/en/expense.json";
import enBudget from "@/locales/en/budget.json";
import enCard from "@/locales/en/card.json";
import enCategory from "@/locales/en/category.json";
import enAsset from "@/locales/en/asset.json";
import enDashboard from "@/locales/en/dashboard.json";
import enDutchPay from "@/locales/en/dutchPay.json";
import enNotification from "@/locales/en/notification.json";
import enLogin from "@/locales/en/login.json";
import enUser from "@/locales/en/user.json";
import enExport from "@/locales/en/export.json";
import enSettings from "@/locales/en/settings.json";
import enStocks from "@/locales/en/stocks.json";
import enDownload from "@/locales/en/download.json";
import enStats from "@/locales/en/stats.json";
import enMore from "@/locales/en/more.json";
import enRecurring from "@/locales/en/recurring.json";
import enSubscription from "@/locales/en/subscription.json";
import enDate from "@/locales/en/date.json";
import enConstellation from "@/locales/en/constellation.json";
import enDs from "@/locales/en/ds.json";

// 지원하는 언어 목록
export const SUPPORTED_LANGUAGES = ["ko", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// 네임스페이스 목록
export const NAMESPACES = [
  "common",
  "layout",
  "todo",
  "calendar",
  "memo",
  "timer",
  "expense",
  "budget",
  "card",
  "category",
  "asset",
  "dashboard",
  "dutchPay",
  "notification",
  "login",
  "user",
  "export",
  "settings",
  "stocks",
  "stats",
  "more",
  "recurring",
  "subscription",
  "date",
  "constellation",
  "download",
  "ds",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

// 리소스 번들
const resources = {
  ko: {
    common: koCommon,
    layout: koLayout,
    todo: koTodo,
    calendar: koCalendar,
    memo: koMemo,
    timer: koTimer,
    expense: koExpense,
    budget: koBudget,
    card: koCard,
    category: koCategory,
    asset: koAsset,
    dashboard: koDashboard,
    dutchPay: koDutchPay,
    notification: koNotification,
    login: koLogin,
    user: koUser,
    export: koExport,
    settings: koSettings,
    stocks: koStocks,
    download: koDownload,
    stats: koStats,
    more: koMore,
    recurring: koRecurring,
    subscription: koSubscription,
    date: koDate,
    constellation: koConstellation,
    ds: koDs,
  },
  en: {
    common: enCommon,
    layout: enLayout,
    todo: enTodo,
    calendar: enCalendar,
    memo: enMemo,
    timer: enTimer,
    expense: enExpense,
    budget: enBudget,
    card: enCard,
    category: enCategory,
    asset: enAsset,
    dashboard: enDashboard,
    dutchPay: enDutchPay,
    notification: enNotification,
    login: enLogin,
    user: enUser,
    export: enExport,
    settings: enSettings,
    stocks: enStocks,
    download: enDownload,
    stats: enStats,
    more: enMore,
    recurring: enRecurring,
    subscription: enSubscription,
    date: enDate,
    constellation: enConstellation,
    ds: enDs,
  },
};

// "시스템" 으로 고른 사람은 지난 방문의 감지 결과를 지우고 브라우저 언어를 다시 읽는다(language-choice.ts)
dropDetectedLanguageIfSystem();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "ko",
    defaultNS: "common",
    ns: NAMESPACES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  });

// 문서 언어를 화면 언어에 맞춘다 — 영어로 바꿨는데 lang 이 ko 로 남으면 낭독기가 영어 글을 한국어 발음으로
// 읽는다(WCAG 3.1.1, I-01 결과 확인 고치기 W1). "en-US" 같은 지역 꼬리는 그대로 둔다.
export function syncDocumentLang(lng: string | undefined) {
  if (typeof document === "undefined" || !lng) return;
  document.documentElement.lang = lng;
}
syncDocumentLang(i18n.resolvedLanguage ?? i18n.language);
i18n.on("languageChanged", syncDocumentLang);

export { i18n };
