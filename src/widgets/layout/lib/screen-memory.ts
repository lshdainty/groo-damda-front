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
  /** 마지막으로 초점이 갔거나 눌린 요소를 다시 찾을 단서 — 요소 자체는 쥐지 않는다(떼어진 화면의 DOM 을 붙잡지 않게) */
  how: Locator | null;
};

type Locator = { id: string; path: number[]; tag: string; label: string };

const spots = new Map<string, Spot>();
let currentKey = "";
// 브라우저 history 길이 정도만 기억한다 — 하루 종일 켜 둔 탭에서 화면을 오갈 때마다 쌓이지 않게(가장 오래된 것부터 버린다)
export const MAX_SPOTS = 50;

/** 시험 사이에 모듈 전역 기억을 끊는다 */
export const resetScreenMemory = () => {
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

/** 단서(id → 자리 → 이름)로 누른 요소를 다시 찾는다 — 화면이 다시 그려져 요소가 새로 생겨도 같은 것을 찾는다 */
export function findSpotElement(spot: Spot, main: HTMLElement) {
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

/**
 * 지금 화면(location.key)이 바뀌었다 — 이후 스크롤 · 초점은 이 키에 적는다.
 * 기억은 스크롤하거나 누를 때 처음 만든다 — 여기서 빈 것을 만들면 새로 고침 뒤 뒤로 온 화면도 "기억이 있다" 가 된다
 */
export function enterScreen(key: string) {
  currentKey = key;
}

function spotForCurrent(): Spot {
  let s = spots.get(currentKey);
  if (!s) {
    s = { scroll: 0, how: null };
    spots.set(currentKey, s);
    if (spots.size > MAX_SPOTS) spots.delete(spots.keys().next().value!);
  }
  return s;
}

/** 셸이 한 번 붙인다 — 돌려주는 함수가 떼어 낸다 */
export function watchScreen() {
  const main = () => document.getElementById("main");
  const note = (target: EventTarget | null) => {
    const box = main();
    if (!box || !(target instanceof Element)) return;
    const el = target.closest(INTERACTIVE);
    // 본문 밖(사이드바 · 머리)에서 누른 것도 적는다 — 그 화면을 떠나는 단추일 수 있다
    if (!el || el === document.body || el === box) return;
    const s = spotForCurrent();
    s.how = box.contains(el) ? locate(el, box) : null;
  };
  const onFocusIn = (e: FocusEvent) => note(e.target);
  // Safari 는 단추를 눌러도 초점이 가지 않는다 — 눌린 요소는 pointerdown 으로 적는다
  const onPointerDown = (e: PointerEvent) => note(e.target);
  const onScroll = (e: Event) => {
    const box = main();
    if (!box || e.target !== box || isRestoring()) return;
    spotForCurrent().scroll = box.scrollTop;
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
 * 뒤로 돌아왔다 — 스크롤을 돌려놓고(맨 위에서 떠났으면 0 으로 — 상세에서 내린 값이 셸 스크롤 상자에 남아 있다),
 * 누른 요소가 다시 그려지면 거기에 초점을 둔다. 돌려줄 기억이 없으면 false(앞으로 갈 때처럼 맨 위 + 제목).
 * 누른 요소를 끝내 못 찾으면(목록이 달라졌거나 재렌더로 사라짐) 제목이 아니라 본문(main)에 초점을 둔다 —
 * 다음 Tab 이 화면 맨 위가 아니라 복원한 자리 근처에서 시작한다. 그 사이 사용자가 누르거나 초점을 옮기면 루프를 멈춘다. 반환 함수는 중단.
 */
export function restoreScreen(key: string): (() => void) | false {
  const spot = spots.get(key);
  const box = document.getElementById("main");
  if (!spot || !box) return false;
  const stopScroll = restoreScroll(box, spot.scroll);
  if (!spot.how) {
    box.focus({ preventScroll: true });
    return () => stopScroll();
  }
  let frame = 0;
  let done = false;
  const start = performance.now();
  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  };
  const tick = () => {
    if (done) return;
    const el = findSpotElement(spot, box);
    if (el) {
      el.focus({ preventScroll: true });
      stop();
      return;
    }
    if (performance.now() - start > RESTORE_WAIT) {
      box.focus({ preventScroll: true });
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);
  frame = requestAnimationFrame(tick);
  return () => {
    stopScroll();
    stop();
  };
}
