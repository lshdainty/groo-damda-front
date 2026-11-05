import { useEffect } from "react";

/**
 * 화면 전체를 덮는 폰 껍데기(`fixed inset-0`)가 떠 있는 동안 아래 탭 바를 `inert` 로 둔다.
 *
 * 껍데기가 탭 바를 시각적으로 덮어도 탭 바는 DOM 에 남아 Tab 초점이 가려진 탭 바로 넘어가고, 스낵바도 가려진 탭 바 윗변을
 * 피할 자리로 잡는다(snackbar 는 aria-hidden · inert 인 요소를 건너뛴다). 덮는 동안만 inert — 껍데기가 사라지면 원래대로.
 */
export function useCoverBottomNav(active = true) {
  useEffect(() => {
    if (!active) return;
    const bars = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-slot=bottom-navigation]",
      ),
    ].filter((el) => !el.hasAttribute("inert"));
    for (const el of bars) el.setAttribute("inert", "");
    return () => {
      for (const el of bars) el.removeAttribute("inert");
    };
  }, [active]);
}
