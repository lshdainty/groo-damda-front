import { createContext, useContext } from "react";

/**
 * 설정 본문을 틀 밖에서 한 번만 그리고, 틀(폰 하위 화면 · 태블릿 · 두 칸)은 자리만 내주게 한다(I-wrap-b1 ε 9).
 *
 * 틀 셋은 서로 다른 부품이라 본문을 틀 안에서 그리면 폭이 768 · 1280 을 넘나들 때 본문이 내려갔다 다시 붙으며
 * 열린 시트(증권사 연동 · 편집 시트 …)와 쓰던 값이 사라진다. 그래서 본문은 페이지가 `createPortal` 로 떨어진
 * 상자(host)에 그리고, 지금 틀의 `SettingsBodySlot` 이 그 상자를 제 자리에 끼운다 — 틀이 바뀌면 상자만 옮겨 간다.
 * 상자 · 자리는 `display: contents` 라 레이아웃에 끼지 않는다.
 */
export function createSettingsBodyHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-slot", "settings-body");
  host.style.display = "contents";
  return host;
}

/**
 * 틀(SettingsContent)이 둔 "제목 줄 자리" 를 페이지에 알린다 — 본문은 틀의 React 자식이 아니라 페이지의 포털이라,
 * 틀이 주는 SettingsFrameContext 를 본문이 직접 읽지 못한다. 페이지가 이 값으로 본문 쪽 맥락을 다시 준다.
 */
export const SettingsHeadSlotReportContext = createContext<
  ((el: HTMLElement | null) => void) | null
>(null);

export function useReportHeadSlot() {
  return useContext(SettingsHeadSlotReportContext);
}
