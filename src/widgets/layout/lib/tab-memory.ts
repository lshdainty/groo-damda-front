import { asScrollHost, type ScrollHost } from "@/shared/lib/groo/scroll-host";
import {
  isAllTab,
  isCalendarTab,
  isExpenseTab,
  isHomeTab,
} from "../model/shell";

/*
 * 하단 탭의 "마지막 위치" 기억 — 탭마다 마지막 화면(경로 + 쿼리)과 본문 스크롤을 들고 있다가
 * 다른 탭에서 돌아오면 거기로 보낸다(Q-017 18-4 A). 지금 탭을 다시 누르면 첫 화면 + 맨 위(forget).
 *
 * 값은 모듈 안에만 둔다 — 새로 고침 · 탭 닫기에서는 사라진다(세션 안의 편의라 저장하지 않는다).
 * 한계: 스크롤 복원은 본문이 그려져 그 높이가 생긴 뒤에야 가능하다. 지연 로딩 · 서버 데이터를 기다리다
 * RESTORE_WAIT 안에 높이가 못 따라오면 닿는 데까지만 간다. 스켈레톤이 먼저 높이를 만들면 그 높이에서
 * 복원된 뒤 실제 내용으로 바뀔 때 어긋날 수 있다. 사용자가 손을 대면(휠 · 터치) 복원을 멈춘다.
 */

export type TabId = "home" | "expense" | "calendar" | "all";

type Entry = { path: string; scroll: number };
const memory = new Map<TabId, Entry>();

export function tabOf(pathname: string): TabId | null {
  if (isHomeTab(pathname)) return "home";
  if (isExpenseTab(pathname)) return "expense";
  if (isCalendarTab(pathname)) return "calendar";
  if (isAllTab(pathname)) return "all";
  return null;
}

/** 지금 화면을 그 탭의 마지막 화면으로 — 화면이 바뀌면 스크롤은 0 에서 다시 센다 */
export function remember(tab: TabId, path: string) {
  const e = memory.get(tab);
  memory.set(tab, { path, scroll: e?.path === path ? e.scroll : 0 });
}

export function rememberScroll(tab: TabId, scroll: number) {
  const e = memory.get(tab);
  if (e) e.scroll = scroll;
}

export const recall = (tab: TabId) => memory.get(tab);

/** 지금 탭을 다시 눌렀다 — 첫 화면 + 맨 위로 되돌린다 */
export function forget(tab: TabId, firstPath: string) {
  memory.set(tab, { path: firstPath, scroll: 0 });
}

// 탭을 눌러 옮기는 중 — 도착한 화면에서 이 스크롤로 복원한다
let pending: { tab: TabId; scroll: number } | null = null;
export function expectRestore(tab: TabId, scroll: number) {
  pending = scroll > 0 ? { tab, scroll } : null;
}
export function takePending(tab: TabId | null) {
  const p = pending && pending.tab === tab ? pending.scroll : null;
  if (p !== null) pending = null;
  return p;
}

export const RESTORE_WAIT = 1500;
// 복원하는 동안 스크롤 이벤트로 기억을 덮어쓰지 않는다(새 화면이 0 에서 시작하므로)
let restoring = false;
export const isRestoring = () => restoring;

/** 본문 높이가 y 에 닿을 때까지 프레임마다 보다가 이동한다. 돌려주는 함수는 중단 — box 는 스크롤 상자(요소 또는 문서) */
export function restoreScroll(target: HTMLElement | ScrollHost, y: number) {
  const box = asScrollHost(target);
  let frame = 0;
  let stopped = false;
  const start = performance.now();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    restoring = false;
    cancelAnimationFrame(frame);
    box.eventTarget.removeEventListener("wheel", onInput);
    box.eventTarget.removeEventListener("touchstart", onInput);
  };
  // 문서는 페이지 전체에서 들리므로 셸(.m-app) 밖의 시트 · 대화상자를 만진 것은 본문을 만진 게 아니다(F3). 머리 · 탭 바에서 끌어도 문서는 스크롤한다
  const onInput = (e: Event) => {
    if (box.ownsInput(e)) stop();
  };
  const tick = () => {
    if (stopped) return;
    const max = box.getMax();
    if (max >= y) {
      box.setTop(y);
      stop();
    } else if (performance.now() - start > RESTORE_WAIT) {
      box.setTop(Math.max(0, max));
      stop();
    } else {
      frame = requestAnimationFrame(tick);
    }
  };
  restoring = true;
  box.eventTarget.addEventListener("wheel", onInput, { passive: true });
  box.eventTarget.addEventListener("touchstart", onInput, { passive: true });
  frame = requestAnimationFrame(tick);
  return stop;
}
