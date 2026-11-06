/*
 * 모든 시험 파일 앞에서 한 번 도는 준비 — vitest.config.ts 의 setupFiles.
 *
 * ① 언어를 한국어로 고정한다. i18n 감지 순서는 localStorage(`i18nextLng`) → navigator 이고 jsdom 의
 *    navigator.language 는 en-US 라, 아무것도 안 하면 i18n 을 불러오는 시험이 영어로 돈다. 시험들은 "기본 한국어" 를
 *    전제로 쓰였다(영어를 재는 시험은 각자 changeLanguage("en") 을 한다).
 * ② jsdom 에 없는 브라우저 API 를 비워 둔다 — Element.scrollIntoView(오류 칸으로 옮기기, useScrollToError) ·
 *    Element.scrollTo(실패하면 시트 본문을 맨 위로).
 */

try {
  localStorage.setItem("i18nextLng", "ko");
} catch {
  // 저장 칸이 없는 환경(node 시험) — navigator 쪽만 고친다
}

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => "ko-KR",
  });
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => ["ko-KR", "ko"],
  });
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}
