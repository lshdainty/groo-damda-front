/*
 * 모든 시험 파일 앞에서 한 번 도는 준비 — vitest.config.ts 의 setupFiles.
 *
 * ① 언어를 한국어로 고정한다. i18n 감지 순서는 localStorage(`i18nextLng`) → navigator 이고 jsdom 의
 *    navigator.language 는 en-US 라, 아무것도 안 하면 i18n 을 불러오는 시험이 영어로 돈다. 시험들은 "기본 한국어" 를
 *    전제로 쓰였다(영어를 재는 시험은 각자 changeLanguage("en") 을 한다).
 * ② jsdom 에 없는 브라우저 API 를 비워 둔다 — Element.scrollIntoView(오류 칸으로 옮기기, useScrollToError) ·
 *    Element.scrollTo(실패하면 시트 본문을 맨 위로).
 * ③ 시험 사이에 기기 뒤로 가기 상태가 새지 않게 한다 — 아래 afterEach 의 까닭.
 */

import { afterEach, vi } from "vitest";

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

/*
 * 1280 미만 표면(시트 · 확인창)은 열 때 히스토리에 칸을 쌓고, 버튼 · Esc · 언마운트로 닫으면 history.go(-n) 으로 되돌리며
 * "내가 되돌린 popstate 하나는 건너뛴다" 고 센다(src/shared/ds/overlay/use-back-close.ts 의 selfPops — 모듈 상태).
 * jsdom 은 같은 틱에 겹친 history.go 를 한 번의 이동으로 합쳐 popstate 를 덜 보내는 일이 있어, 센 값이 남아 다음 시험의
 * 첫 뒤로 가기를 삼켰다(혼자 돌리면 통과하고 파일째 돌리면 깨짐). 시험이 끝나면 밀린 이동을 흘려 보내고, 남은 셈은 빈
 * popstate 로 비운다 — 이때 열린 표면은 없으므로(각 파일 afterEach 가 먼저 내린다) 아무것도 닫히지 않는다.
 */
afterEach(async () => {
  if (typeof window === "undefined" || vi.isFakeTimers()) return;
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 8; i++)
    window.dispatchEvent(new PopStateEvent("popstate"));
});
