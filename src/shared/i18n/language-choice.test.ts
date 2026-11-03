// 언어 "시스템" (I-14 20) — 고르면 저장해 둔 언어를 지우고 브라우저 언어를 따른다. 새로 고쳐도 "시스템" 이 골라져 있어야 한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "./config";
import {
  applyLanguageChoice,
  dropDetectedLanguageIfSystem,
  readLanguageChoice,
} from "./language-choice";

beforeEach(() => localStorage.clear());
afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("ko");
});

describe("언어 고르기", () => {
  it("시스템을 고르면 i18nextLng 가 없고 새로 고침 뒤에도 시스템이다", async () => {
    await applyLanguageChoice(i18n, "system");
    expect(localStorage.getItem("i18nextLng")).toBeNull();
    expect(readLanguageChoice(i18n.language)).toBe("system");
  });

  it("시스템으로 고른 사람은 지난 방문의 감지 결과를 초기화 직전에 지운다", () => {
    localStorage.setItem("groo:language-mode", "system");
    localStorage.setItem("i18nextLng", "en");
    dropDetectedLanguageIfSystem();
    expect(localStorage.getItem("i18nextLng")).toBeNull();
  });

  it("한국어 · English 를 고르면 시스템 표시가 풀린다", async () => {
    await applyLanguageChoice(i18n, "system");
    await applyLanguageChoice(i18n, "en");
    expect(readLanguageChoice(i18n.language)).toBe("en");
    expect(localStorage.getItem("groo:language-mode")).toBeNull();
    await applyLanguageChoice(i18n, "ko");
    expect(readLanguageChoice(i18n.language)).toBe("ko");
  });
});
