/*
 * 폰 셸의 위 · 아래 고정 줄 높이 — 문서가 스크롤하므로(I-fix-2.0.0 B) 머리 · 가계부 탭은 sticky 이고, 그 아래에 붙는 줄(달 이동 줄 ·
 * 검색 칩 줄 · 전체 탭 검색칸 · 통계 칩 탭)이 `--shell-top` 하나를 읽어 top 을 잡는다. 포커스가 머리 뒤로 가려지지 않게
 * 같은 값을 scroll-padding 으로도 준다. 768 이상은 이 값을 쓰지 않는다(`var(--shell-top, 0px)` — 본문 상자가 머리 아래에서 시작한다).
 */
import { BOTTOM_NAVIGATION_INSET } from "@/shared/ds/bottom-navigation";

/** 상단 바 높이(top-navigation.yaml 56) — 위 안전 영역은 바가 더 얹는다 */
export const SHELL_HEADER_HEIGHT = 56;
/** 가계부 묶음 Line Tabs medium 높이(tabs.yaml 44) */
export const SHELL_MONEY_TABS_HEIGHT = 44;

export const SHELL_HEAD = `calc(${SHELL_HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`;

/** 폰 머리(+가계부 탭) 아래 첫 줄의 top — 가계부 묶음이면 탭 44 를 더한다 */
export function shellTop(money: boolean) {
  return money
    ? `calc(${SHELL_HEAD} + ${SHELL_MONEY_TABS_HEIGHT}px)`
    : SHELL_HEAD;
}

export type ShellInsets = {
  "--shell-head": string;
  "--shell-top": string;
  scrollPaddingTop: string;
  scrollPaddingBottom: string;
};

/** `<html>` 에 거는 값 — 탭 바가 있으면 본문 아래 여백만큼 포커스 · scrollIntoView 가 탭 바 위에서 멈춘다 */
export function shellInsets({
  money,
  tabBar,
}: {
  money: boolean;
  tabBar: boolean;
}): ShellInsets {
  const top = shellTop(money);
  return {
    "--shell-head": SHELL_HEAD,
    "--shell-top": top,
    scrollPaddingTop: top,
    scrollPaddingBottom: tabBar ? BOTTOM_NAVIGATION_INSET : "0px",
  };
}

/** 가계부 탭(Line Tabs) 루트 — 실제 높이를 잰다(글자를 키우면 min-h 44 를 넘는다) */
export const MONEY_TABS_ATTR = "data-shell-money-tabs";
const HEADER_SELECTOR = ".m-app header";

/**
 * 값을 `<html>` 에 걸고 되돌리는 함수를 돌려준다. 상수(56 · 44)는 측정 전 첫 프레임 값이다 — 머리 · 가계부 탭의 실제 높이가
 * 재지면(ResizeObserver) 그 값으로 바꾼다. 가계부 탭은 `min-h-[44px]` + 위아래 10 + 줄 높이(rem)라 루트 글자가 커지면 44 를 넘고,
 * 고정 44 로 두면 아래 줄(달 이동 줄)이 탭 밑으로 들어가 가린다. 고정 높이로 자르면 큰 글자에서 탭 글이 잘리므로 재는 쪽이다.
 */
export function applyShellInsets(
  root: HTMLElement,
  insets: ShellInsets,
): () => void {
  const prev = {
    head: root.style.getPropertyValue("--shell-head"),
    top: root.style.getPropertyValue("--shell-top"),
    padTop: root.style.scrollPaddingTop,
    padBottom: root.style.scrollPaddingBottom,
  };
  const set = (head: string, top: string) => {
    root.style.setProperty("--shell-head", head);
    root.style.setProperty("--shell-top", top);
    root.style.scrollPaddingTop = top;
  };
  set(insets["--shell-head"], insets["--shell-top"]);
  root.style.scrollPaddingBottom = insets.scrollPaddingBottom;

  const header = root.querySelector<HTMLElement>(HEADER_SELECTOR);
  const tabs = root.querySelector<HTMLElement>(`[${MONEY_TABS_ATTR}]`);
  const measure = () => {
    const h = header?.getBoundingClientRect().height ?? 0;
    const t = tabs?.getBoundingClientRect().height ?? 0;
    // 안 재지면(0 — 아직 레이아웃 전 · 없는 줄) 상수를 그대로 둔다
    if (h <= 0 && t <= 0) return;
    const head = h > 0 ? `${h}px` : insets["--shell-head"];
    set(head, t > 0 ? `calc(${head} + ${t}px)` : head);
  };
  measure();
  let ro: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined" && (header || tabs)) {
    ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    if (tabs) ro.observe(tabs);
  }
  return () => {
    ro?.disconnect();
    for (const [k, v] of [
      ["--shell-head", prev.head],
      ["--shell-top", prev.top],
    ] as const) {
      if (v) root.style.setProperty(k, v);
      else root.style.removeProperty(k);
    }
    root.style.scrollPaddingTop = prev.padTop;
    root.style.scrollPaddingBottom = prev.padBottom;
  };
}
