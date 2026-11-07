import { restoreScroll, isRestoring, RESTORE_WAIT } from "./tab-memory";

/*
 * 화면을 떠날 때의 본문 스크롤 · 누른 요소를 location.key 별로 적어 두었다가, 뒤로(POP) 돌아오면 돌려준다.
 * top-navigation.md:230 "뒤로 가기로 돌아오면 스크롤 위치를 돌려놓는다". 앞으로 갈 때(PUSH)는 셸이 맨 위 + 제목 초점이다.
 *
 * 값은 모듈 메모리에만 둔다(세션 한정) — 새로 고침하면 사라지고, 그때 POP 은 기억이 없어 PUSH 처럼 맨 위 + 제목으로 간다.
 * 스크롤은 떠나는 순간이 아니라 스크롤할 때마다 적는다: 새 화면이 그려지면 짧아진 본문이 scrollTop 을 먼저 깎기 때문이다.
 */

export type Spot = {
  scroll: number;
  /** 마지막으로 초점이 갔거나 눌린 요소 — 화면이 다시 그려져도 살아 있으면 그대로 쓴다 */
  el: Element | null;
  /** 요소가 새로 그려졌을 때 다시 찾을 단서 */
  how: Locator | null;
};

type Locator = { id: string; path: number[]; tag: string; label: string };

const spots = new Map<string, Spot>();
let currentKey = "";

export const spotOf = (key: string) => spots.get(key);
export const clearSpots = () => {
  spots.clear();
  currentKey = "";
};

const INTERACTIVE =
  'a[href],button,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="switch"],[role="radio"],[tabindex]';

const labelOf = (el: Element) =>
  (el.getAttribute("aria-label") ?? el.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

function locate(el: Element, root: Element): Locator | null {
  const path: number[] = [];
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const p: Element | null = n.parentElement;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.children, n));
  }
  return { id: el.id, path, tag: el.tagName, label: labelOf(el) };
}

/** 적어 둔 요소가 사라졌으면(재렌더) 단서로 같은 요소를 다시 찾는다 */
export function findSpotElement(spot: Spot, main: HTMLElement) {
  if (spot.el?.isConnected) return spot.el as HTMLElement;
  const how = spot.how;
  if (!how) return null;
  if (how.id) {
    const byId = document.getElementById(how.id);
    if (byId && main.contains(byId)) return byId;
  }
  let node: Element | null = main;
  for (const i of how.path) node = node?.children[i] ?? null;
  if (node && node.tagName === how.tag && labelOf(node) === how.label)
    return node as HTMLElement;
  if (!how.label) return null;
  const same = Array.from(
    main.querySelectorAll<HTMLElement>(INTERACTIVE),
  ).filter((c) => c.tagName === how.tag && labelOf(c) === how.label);
  return same.length === 1 ? same[0] : null;
}

/** 지금 화면(location.key)이 바뀌었다 — 이후 스크롤 · 초점은 이 키에 적는다 */
export function enterScreen(key: string) {
  currentKey = key;
  if (!spots.has(key)) spots.set(key, { scroll: 0, el: null, how: null });
}

/** 셸이 한 번 붙인다 — 돌려주는 함수가 떼어 낸다 */
export function watchScreen() {
  const main = () => document.getElementById("main");
  const spot = () => spots.get(currentKey);
  const note = (target: EventTarget | null) => {
    const s = spot();
    const box = main();
    if (!s || !box || !(target instanceof Element)) return;
    const el = target.closest(INTERACTIVE);
    // 본문 밖(사이드바 · 머리)에서 누른 것도 적는다 — 그 화면을 떠나는 단추일 수 있다
    if (!el || el === document.body || el === box) return;
    s.el = el;
    s.how = box.contains(el) ? locate(el, box) : null;
  };
  const onFocusIn = (e: FocusEvent) => note(e.target);
  // Safari 는 단추를 눌러도 초점이 가지 않는다 — 눌린 요소는 pointerdown 으로 적는다
  const onPointerDown = (e: PointerEvent) => note(e.target);
  const onScroll = (e: Event) => {
    const box = main();
    if (!box || e.target !== box || isRestoring()) return;
    const s = spot();
    if (s) s.scroll = box.scrollTop;
  };
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("scroll", onScroll, true);
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("scroll", onScroll, true);
  };
}

/**
 * 뒤로 돌아왔다 — 스크롤을 돌려놓고, 누른 요소가 다시 그려지면 거기에 초점을 둔다. 돌려줄 기억이 없으면 false.
 * 누른 요소를 끝내 못 찾으면(목록이 달라졌거나 재렌더로 사라짐) 제목이 아니라 본문(main)에 초점을 둔다 —
 * 다음 Tab 이 화면 맨 위가 아니라 복원한 자리 근처에서 시작한다. 반환 함수는 중단.
 */
export function restoreScreen(key: string): (() => void) | false {
  const spot = spots.get(key);
  const box = document.getElementById("main");
  if (!spot || !box) return false;
  const stopScroll = spot.scroll > 0 ? restoreScroll(box, spot.scroll) : null;
  let frame = 0;
  const start = performance.now();
  const tick = () => {
    const el = findSpotElement(spot, box);
    if (el) {
      el.focus({ preventScroll: true });
      return;
    }
    if (performance.now() - start > RESTORE_WAIT) {
      box.focus({ preventScroll: true });
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    stopScroll?.();
    cancelAnimationFrame(frame);
  };
}
