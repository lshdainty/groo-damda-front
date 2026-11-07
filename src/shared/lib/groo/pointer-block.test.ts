// 모달·시트·확인창이 닫힌 직후, 두 번째 클릭이 그 자리 밑의 요소로 떨어져 엉뚱한 일이
// 벌어졌다 — 달력 셀이 눌리고(QA #14 #36), 모바일 탭바가 눌려 통계 화면으로 넘어가고
// (#37), 삭제 확인창 뒤에선 그 자리로 올라온 다른 거래의 상세가 열렸다(#57).
// 여기서 잠그는 건 "닫힘 직후 짧은 창 동안 뒤 화면이 포인터를 안 받는다" 한 줄이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POINTER_BLOCK_MS,
  __resetPointerBlockForTest,
  beginPointerBlock,
  cancelPointerBlock,
  isPointerBlocked,
  registerOverlay,
} from "./pointer-block";

/** jsdom 엔 PointerEvent/TouchEvent 생성자가 없다 — 타입만 맞으면 전파 경로는 같다. */
function fire(el: Element, type: string): Event {
  const e =
    type === "click" || type === "dblclick" || type.startsWith("mouse")
      ? new MouseEvent(type, { bubbles: true, cancelable: true })
      : new Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
}

let spy: (e: Event) => void;
let back: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
  __resetPointerBlockForTest();
  spy = vi.fn<(e: Event) => void>();
  back = document.createElement("button");
  // 뒤 화면의 요소 — 달력 셀·탭바 버튼·목록 행이 전부 이 자리다.
  for (const type of [
    "click",
    "mousedown",
    "mouseup",
    "pointerdown",
    "touchstart",
  ] as const)
    back.addEventListener(type, spy);
  document.body.appendChild(back);
});

afterEach(() => {
  __resetPointerBlockForTest();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("포인터 차단 창", () => {
  it("차단 중엔 뒤 화면의 클릭이 도달하지 않는다", () => {
    beginPointerBlock();
    fire(back, "click");
    expect(spy).not.toHaveBeenCalled();
  });

  it("창이 지나면 다시 눌린다 — 영구히 죽으면 화면을 못 쓴다", () => {
    beginPointerBlock();
    vi.advanceTimersByTime(POINTER_BLOCK_MS + 50);
    fire(back, "click");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("mousedown·mouseup·pointerdown 도 삼킨다 — 캘린더 셀은 click 이 아니라 그 둘로 눌린다(#36)", () => {
    beginPointerBlock();
    fire(back, "mousedown");
    fire(back, "mouseup");
    fire(back, "pointerdown");
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(POINTER_BLOCK_MS + 1);
    fire(back, "mousedown");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("touch 계열은 전파만 막고 preventDefault 는 안 한다 — 차단 창 동안 스크롤까지 죽으면 안 된다", () => {
    beginPointerBlock();
    const e = fire(back, "touchstart");
    expect(spy).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    const moved = fire(back, "touchmove");
    // touchmove 는 아예 대상이 아니다 — 진행 중인 스크롤·스와이프를 끊지 않는다.
    expect(moved.defaultPrevented).toBe(false);
  });

  it("클릭 계열은 preventDefault 까지 건다 — 링크·라벨의 기본 동작도 같이 막는다", () => {
    beginPointerBlock();
    expect(fire(back, "click").defaultPrevented).toBe(true);
    expect(fire(back, "mousedown").defaultPrevented).toBe(true);
  });

  it("아직 떠 있는 오버레이 안과 스낵바는 차단 중에도 눌린다", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inside = document.createElement("button");
    inside.addEventListener("click", spy);
    dialog.appendChild(inside);
    const toast = document.createElement("div");
    toast.setAttribute("data-slot", "snackbar-region");
    const undo = document.createElement("button");
    undo.addEventListener("click", spy);
    toast.appendChild(undo);
    document.body.append(dialog, toast);

    beginPointerBlock();
    fire(inside, "click");
    fire(undo, "click");
    fire(back, "click");
    expect(spy).toHaveBeenCalledTimes(2); // 뒤 화면 버튼만 삼켜졌다
  });

  it("cancelPointerBlock 은 즉시 푼다", () => {
    beginPointerBlock();
    expect(isPointerBlocked()).toBe(true);
    cancelPointerBlock();
    expect(isPointerBlocked()).toBe(false);
    fire(back, "click");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("오버레이 생애 등록", () => {
  it("중첩 모달의 안쪽만 닫히면 차단하지 않는다 — 바깥 모달은 계속 눌려야 한다", () => {
    const outer = registerOverlay();
    const inner = registerOverlay();
    inner();
    expect(isPointerBlocked()).toBe(false);
    outer();
    expect(isPointerBlocked()).toBe(true);
  });

  it("닫히자마자 새 오버레이가 뜨면 차단이 풀린다 — 상세→편집 연속 열기·StrictMode 이중 마운트", () => {
    const close = registerOverlay();
    close();
    expect(isPointerBlocked()).toBe(true);
    registerOverlay();
    expect(isPointerBlocked()).toBe(false);
  });
});

describe("재현 시나리오", () => {
  it("#37 시트 닫힘 직후의 탭바 탭이 화면을 넘기지 못한다", () => {
    const nav = vi.fn<(e: Event) => void>();
    const tab = document.createElement("button");
    tab.addEventListener("pointerdown", nav);
    tab.addEventListener("click", nav);
    document.body.appendChild(tab);

    const close = registerOverlay(); // 시트가 떴다
    close(); // 저장 후 시트가 사라졌다
    fire(tab, "pointerdown");
    fire(tab, "click");
    expect(nav).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    fire(tab, "pointerdown");
    fire(tab, "click");
    expect(nav).toHaveBeenCalledTimes(2);
  });

  it("#57 삭제 확인창 닫힘 직후, 그 자리로 올라온 행의 상세가 열리지 않는다", () => {
    const openDetail = vi.fn<(e: Event) => void>();
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    const rowBtn = document.createElement("button");
    rowBtn.addEventListener("pointerdown", openDetail);
    rowBtn.addEventListener("click", openDetail);
    row.appendChild(rowBtn);
    document.body.appendChild(row);

    const close = registerOverlay();
    close();
    fire(rowBtn, "pointerdown");
    fire(rowBtn, "click");
    expect(openDetail).not.toHaveBeenCalled();
  });
});
