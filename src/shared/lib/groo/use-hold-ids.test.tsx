// 완료 토글처럼 누른 즉시 목록에서 빠지는 항목을, 그 자리에 잠깐 붙들어 둔다(QA #29).
// 여기서 잠그는 건 "붙든 id 가 정해진 시간 뒤 스스로 풀린다" 와 "붙드는 동안 다른 항목은
// 건드리지 않는다" 두 가지다. 목록 필터 쪽 계약은 pages/todo/model/todo-ledger.test.ts.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_HOLD_MS, REPEAT_TAP_GUARD_MS, useHoldIds } from "./use-hold-ids";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/** 마지막 렌더의 훅 반환값 — 테스트에서 직접 부르고 읽는다.
 *  렌더 중에 대입하면 순수성 규칙에 걸리므로 effect 에서 옮긴다(act 가 flush 한다). */
let api: ReturnType<typeof useHoldIds>;

function Harness({ ms }: { ms?: number }) {
  const value = useHoldIds(ms);
  useEffect(() => {
    api = value;
  });
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const hold = (id: number) => act(() => api.hold(id));
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useHoldIds", () => {
  it("붙들기 전엔 비어 있다", () => {
    expect(api.holdIds.size).toBe(0);
  });

  it("붙들면 들어가고, 정해진 시간이 지나면 스스로 풀린다", () => {
    hold(7);
    expect(api.holdIds.has(7)).toBe(true);

    tick(LIST_HOLD_MS - 1);
    expect(api.holdIds.has(7)).toBe(true); // 아직은 자리를 지킨다

    tick(2);
    expect(api.holdIds.has(7)).toBe(false); // 영구히 남으면 완료 항목이 안 사라진다
  });

  it("붙드는 시간은 재탭 방어보다 길어야 한다", () => {
    // 방어가 먼저 풀리고 행이 이미 빠져 있으면, 그 사이 두 번째 탭이 다시
    // *다른* 항목으로 떨어진다 — 결함이 그대로 돌아온다.
    expect(LIST_HOLD_MS).toBeGreaterThan(REPEAT_TAP_GUARD_MS);
  });

  it("여러 항목을 각자 타이머로 붙든다", () => {
    hold(1);
    tick(300);
    hold(2);
    expect([...api.holdIds].sort()).toEqual([1, 2]);

    tick(LIST_HOLD_MS - 300 + 1); // 1 번만 만료
    expect([...api.holdIds]).toEqual([2]);

    tick(300);
    expect(api.holdIds.size).toBe(0);
  });

  it("같은 항목을 다시 누르면 타이머가 연장된다 — 따닥 누른 뒤 곧바로 빠지면 안 된다", () => {
    hold(5);
    tick(LIST_HOLD_MS - 50);
    hold(5);
    tick(LIST_HOLD_MS - 50);
    expect(api.holdIds.has(5)).toBe(true);
    tick(60);
    expect(api.holdIds.has(5)).toBe(false);
  });

  it("이미 붙든 항목을 또 눌러도 같은 Set 을 돌려준다 — 목록 useMemo 가 헛돌면 안 된다", () => {
    hold(3);
    const first = api.holdIds;
    hold(3);
    expect(api.holdIds).toBe(first);
  });

  it("ms 를 넘겨 창을 바꿀 수 있다", () => {
    act(() => root.render(<Harness ms={100} />));
    hold(1);
    tick(101);
    expect(api.holdIds.size).toBe(0);
  });

  it("언마운트하면 남은 타이머를 끊는다 — 사라진 컴포넌트를 깨우지 않는다", () => {
    hold(1);
    hold(2);
    expect(vi.getTimerCount()).toBe(2);

    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);

    // afterEach 의 unmount 가 두 번 불려도 안전하도록 다시 만들어 둔다.
    root = createRoot(container);
  });
});
