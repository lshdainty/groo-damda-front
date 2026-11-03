/**
 * 화면 언어 고르기 — "시스템" · 한국어 · English (I-14 20).
 *
 * i18next 의 언어 감지(localStorage `i18nextLng` → navigator)는 감지한 결과도 `i18nextLng` 에 다시 적는다. 그래서 "시스템" 을 골랐는지
 * 저장된 값만으로는 알 수 없고(적힌 "ko" 가 사용자가 고른 한국어인지 감지 결과인지), 새로 고침하면 한국어로 굳는다.
 * 그래서 고른 방식을 따로 적는다(`groo:language-mode` = "system"). 시스템이면 감지 결과를 저장 칸에서 지워 매번 브라우저 언어를 따른다.
 */
import type { i18n as I18n } from "i18next";

export type LanguageChoice = "system" | "ko" | "en";

const MODE_KEY = "groo:language-mode";
const DETECTED_KEY = "i18nextLng";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 저장 칸을 못 쓰는 환경(사생활 보호 창 등) — 이번 방문에만 적용된다
  }
}

/** 지금 고른 방식 — 시스템 표시가 있으면 시스템, 아니면 지금 언어 */
export function readLanguageChoice(
  language: string | undefined,
): LanguageChoice {
  if (read(MODE_KEY) === "system") return "system";
  return language?.startsWith("en") ? "en" : "ko";
}

/** 시스템으로 고른 사람의 감지 결과(옛 방문의 `i18nextLng`)를 지운다 — i18n 초기화 직전에 부른다 */
export function dropDetectedLanguageIfSystem() {
  if (read(MODE_KEY) === "system") write(DETECTED_KEY, null);
}

function browserLanguage(): string {
  return typeof navigator === "undefined" ? "ko" : navigator.language || "ko";
}

export async function applyLanguageChoice(i18n: I18n, choice: LanguageChoice) {
  if (choice === "system") {
    write(MODE_KEY, "system");
    await i18n.changeLanguage(browserLanguage());
    // changeLanguage 가 감지 캐시에 적은 값을 지운다 — 남기면 브라우저 언어를 바꿔도 그 값이 먼저 읽힌다
    write(DETECTED_KEY, null);
    return;
  }
  write(MODE_KEY, null);
  await i18n.changeLanguage(choice);
}
