import * as React from "react";

/*
 * 닫히는 표면은 누름을 받지 않는다 — Bottom Sheet · Dialog · Alert Dialog 공통.
 *
 * 닫으면(open → false) 표면은 나가는 모션(시트 200ms · 대화상자 · 확인창 100ms) 동안 화면에 남는다(Radix Presence). 그동안
 *  ① 딤이 누름을 받았다 — Radix 딤은 인라인 pointer-events: auto 다. 닫자마자 누른 하단 탭이 사라지는 딤에 떨어져 씹혔다
 *     (QA 2026-11-17 iPhone 17 Pro · Safari 26, dev f70e3f87 — "닫은 직후(0.3초 안) 첫 탭은 씹힘, 두 번째 탭에 이동").
 *  ② body 가 pointer-events: none 으로 남았다 — Radix DismissableLayer 가 몸통이 붙어 있는 동안(나가는 모션 포함) 바깥 누름을
 *     막는다. vaul 은 자기 손으로 닫을 때(끌어내리기 · 딤)만 body 를 푼다 — [×] · [나가기] 처럼 open 을 바깥에서 내리면 안 풀린다.
 * 그래서 닫히는 딤 · 몸통은 CLOSING_INERT 로 누름을 흘려보내고, 닫는 순간 body 를 푼다(useInertWhileClosing) — 아직 열린
 * 모달 표면이 남아 있으면(시트 위 확인창만 닫힘) 그 표면의 막기는 그대로 둔다.
 *
 * 반대 방향도 막는다 — 따닥(두 번 누르기)의 두 번째 탭이 사라지는 표면을 지나 뒤 화면을 누르면 안 된다(QA #14 · #36 · #37 ·
 * #57: [저장] 따닥 → 시트 바닥 밑 하단 탭이 눌려 통계로 넘어감). 예전에는 닫힌 뒤 350ms 동안 모든 누름을 삼켰는데
 * (pointer-block — 걷었다) 그러면 일부러 누른 첫 탭까지 사라진다. 여기서는 닫은 누름과 **같은 자리**(FOLLOW_UP_RADIUS 안)에
 * **곧바로**(닫은 누름부터 FOLLOW_UP_MS 안) 온 누름 한 번만 삼킨다 — 다른 자리(오른쪽 위 [×] ↔ 하단 탭)는 바로 통과한다.
 * 딤을 마우스로 눌러 닫은 경우처럼 닫은 누름의 나머지(pointerup · mouseup · click)가 닫힌 뒤에 오는 것도 같은 자리라 삼킨다.
 * 키보드로 누른 것(click detail 0)과 포인터 종류가 없는 이벤트는 보지 않는다.
 */

/** 닫히는 딤 · 몸통(data-state=closed)은 누름을 흘려보낸다 — Radix 의 인라인 pointer-events: auto 를 이긴다 */
export const CLOSING_INERT = "data-[state=closed]:pointer-events-none!";

/** 따닥의 두 번째 누름으로 보는 시간 — 닫은 누름(pointerdown)부터. 이보다 늦게 닫히면(저장 응답 뒤) 지키지 않는다 */
const FOLLOW_UP_MS = 500;
/** 같은 자리로 보는 거리 — 누르는 영역 44 */
const FOLLOW_UP_RADIUS = 44;
/** 삼키기 시작한 누름의 나머지(up · click)를 기다리는 시간 */
const REST_MS = 1000;

type Spot = { x: number; y: number };
let lastDown: (Spot & { t: number }) | null = null;
let held = false;
let guard: (Spot & { until: number }) | null = null;
let swallow: (Spot & { until: number }) | null = null;
let installed = false;

const isPointer = (e: Event): e is PointerEvent =>
  "pointerType" in e && Boolean((e as PointerEvent).pointerType);
const near = (e: MouseEvent, p: Spot) =>
  Math.hypot(e.clientX - p.x, e.clientY - p.y) <= FOLLOW_UP_RADIUS;

function block(e: Event, cancel: boolean) {
  e.stopImmediatePropagation();
  if (cancel && e.cancelable) e.preventDefault();
}

function onPointerDown(e: Event) {
  if (!isPointer(e)) return;
  const now = Date.now();
  if (guard && now <= guard.until && near(e, guard)) {
    guard = null;
    swallow = { x: e.clientX, y: e.clientY, until: now + REST_MS };
    block(e, true);
    return;
  }
  // 다른 자리를 눌렀다 — 따닥이 아니다
  guard = null;
  swallow = null;
  lastDown = { x: e.clientX, y: e.clientY, t: now };
  held = true;
}

function onPointerUp(e: Event) {
  if (isPointer(e)) held = false;
  onRest(e);
}

// 삼키는 누름의 나머지 — 마우스 계열은 같은 자리만, 터치 계열은 전파만 막는다(스크롤 · 핀치를 끊지 않게)
function onRest(e: Event) {
  if (!swallow) return;
  if (Date.now() > swallow.until) {
    swallow = null;
    return;
  }
  if (typeof TouchEvent !== "undefined" && e instanceof TouchEvent) {
    block(e, false);
    return;
  }
  if (!(e instanceof MouseEvent) || !near(e, swallow)) return;
  // 키보드로 누른 click(detail 0)은 사람이 따로 누른 것이다
  if ((e.type === "click" || e.type === "dblclick") && e.detail < 1) return;
  block(e, true);
  if (e.type === "click") swallow = null;
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);
  for (const type of [
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "touchstart",
    "touchend",
  ])
    window.addEventListener(type, onRest, true);
}

/** 표면이 닫혔다 — 닫은 누름이 방금이면 같은 자리 두 번째 누름을 지킨다 */
function armFollowUpGuard() {
  const now = Date.now();
  if (!lastDown || now - lastDown.t > FOLLOW_UP_MS) return;
  guard = { x: lastDown.x, y: lastDown.y, until: lastDown.t + FOLLOW_UP_MS };
  // 누른 채 닫혔다(마우스로 딤을 눌러 닫음) — 그 누름의 나머지도 같은 자리라 삼킨다
  if (held) swallow = { x: lastDown.x, y: lastDown.y, until: now + REST_MS };
}

/**
 * 모달 표면의 루트가 부른다 — `open` 이 꺼지는 순간 Radix 가 걸어 둔 바깥 막기(body pointer-events: none)를 풀고(아직 열린
 * 모달 표면이 없을 때만 — 표면이 사라질 때 Radix 가 원래 값으로 되돌린다) 같은 자리 두 번째 누름을 지킨다.
 */
export function useInertWhileClosing(open: boolean) {
  const was = React.useRef(open);
  React.useLayoutEffect(() => {
    install();
    if (was.current && !open) {
      const stillOpen = document.querySelector(
        '[aria-modal="true"][data-state="open"]',
      );
      if (!stillOpen && document.body.style.pointerEvents === "none")
        document.body.style.pointerEvents = "";
      armFollowUpGuard();
    }
    was.current = open;
  }, [open]);
}

/** 시험 전용 — 모듈 상태를 비운다 */
export function __resetClosingSurfaceForTest() {
  lastDown = null;
  held = false;
  guard = null;
  swallow = null;
}
