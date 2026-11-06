// 저장 버튼을 따닥 누르면 같은 요청이 두 번 나갔다(거래 2건 저장, QA 2026-09-02).
// isPending 으로 disabled 되는 건 다음 렌더 뒤라, 렌더와 무관한 동기 방어가 필요하다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/shared/ui/button";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

function clickTwiceQuickly() {
  const btn = container.querySelector("button")!;
  act(() => {
    btn.click();
    btn.click();
  });
}

describe("Button 더블클릭 방어", () => {
  it("loading 을 넘긴(비동기) 버튼은 짧은 창 안의 두 번째 클릭을 버린다", () => {
    const onClick = vi.fn();
    render(
      <Button loading={false} onClick={onClick}>
        저장
      </Button>,
    );
    clickTwiceQuickly();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("창이 지나면 다시 눌린다 — 검증 실패로 요청이 안 나간 뒤 다시 저장할 수 있어야 한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const onClick = vi.fn();
    render(
      <Button loading={false} onClick={onClick}>
        저장
      </Button>,
    );
    const btn = container.querySelector("button")!;
    act(() => btn.click());
    vi.setSystemTime(new Date("2026-09-03T00:00:01Z"));
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("loading 을 안 넘긴(동기) 버튼은 종전대로 매번 눌린다 — 카운터·토글이 여기 해당한다", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>+</Button>);
    clickTwiceQuickly();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("검증 실패 클릭 직후의 클릭은 통과한다", () => {
    // 검증에 걸린 클릭은 아무것도 걸지 않는다 — loading 은 계속 false 다.
    // 그 클릭이 창을 물려받으면 안내를 읽고 고쳐 다시 누른 저장이 버려진다(QA #160).
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <Button loading={false} onClick={onClick}>
        저장
      </Button>,
    );
    const btn = container.querySelector("button")!;
    act(() => btn.click());
    // 이벤트가 끝나고 렌더가 반영된 뒤 — 여기서 "아무것도 안 걸렸다" 가 판명된다.
    act(() => void vi.advanceTimersByTime(1));
    // QA 실측 최단 재클릭 간격(57ms). 가드 창(600ms) 안이다.
    vi.advanceTimersByTime(56);
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("검증을 통과한 저장은 진짜 따닥에도 한 번만 나간다", () => {
    // 되돌림이 생겨도 원래 목적은 그대로여야 한다 — 첫 클릭이 작업을 걸었으면
    // 같은 프레임 안의 두 번째 클릭은 버리고, 그 뒤는 disabled 가 이어받는다.
    vi.useFakeTimers();
    const onClick = vi.fn();
    function Saving() {
      const [loading, setLoading] = useState(false);
      return (
        <Button
          loading={loading}
          onClick={() => {
            onClick();
            setLoading(true);
          }}
        >
          저장
        </Button>
      );
    }
    render(<Saving />);
    clickTwiceQuickly();
    expect(onClick).toHaveBeenCalledTimes(1);
    // 되돌림 타이머가 돌아도 작업이 걸린 클릭의 시각은 남는다(그리고 disabled 다).
    act(() => void vi.advanceTimersByTime(1));
    act(() => container.querySelector("button")!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading 을 안 넘긴 버튼은 되돌림 타이머와 무관하게 연타가 통과한다", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>+</Button>);
    const btn = container.querySelector("button")!;
    act(() => btn.click());
    act(() => void vi.advanceTimersByTime(1));
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("loading 중엔 disabled 다", () => {
    render(<Button loading>저장</Button>);
    expect(container.querySelector("button")!.disabled).toBe(true);
  });
});

// flush 는 한쪽 padding 만 0 이라, hover 에 채움 상자가 뜨면 글자 기준으로 좌우가
// 비대칭이 되어 버튼이 한쪽으로 삐져나온 것처럼 보였다(2026-09-16 실측). flush ghost 는
// 텍스트 버튼으로 취급한다 — 배경 없이 글자색으로만 반응한다(spec button.md Edge flush).
// jsdom 에는 tailwind CSS 가 없으므로 그 값을 만드는 유틸 클래스를 본다.
describe("flush ghost 는 텍스트 버튼이다", () => {
  const cls = () => Array.from(container.querySelector("button")!.classList);

  it("hover 에 배경을 깔지 않는다", () => {
    render(
      <Button variant="ghost" flush="left">
        금액 가리기
      </Button>,
    );
    expect(cls()).toContain("hover:bg-transparent");
    expect(cls()).toContain("active:bg-transparent");
    // 일반 ghost 의 hover 채움이 남아 있으면 상자가 다시 생긴다.
    expect(cls()).not.toContain("hover:bg-surface-input");
    expect(cls()).not.toContain("active:bg-border-default");
  });

  it("글자색으로만 반응한다 — 보조톤에서 본문색으로", () => {
    render(
      <Button variant="ghost" flush="left">
        금액 가리기
      </Button>,
    );
    expect(cls()).toContain("text-text-secondary");
    expect(cls()).toContain("hover:text-text-primary");
    expect(cls()).toContain("focus-visible:text-text-primary");
  });

  it("해당 방향 padding 만 0 이다 — 반대쪽은 그대로", () => {
    render(
      <Button variant="ghost" flush="left">
        뒤로
      </Button>,
    );
    expect(cls()).toContain("pl-0");
    expect(cls()).not.toContain("pr-0");
  });

  it("flush 를 안 붙인 ghost 는 지금 규칙 그대로다", () => {
    render(<Button variant="ghost">툴바</Button>);
    expect(cls()).toContain("hover:bg-surface-input");
    expect(cls()).not.toContain("hover:bg-transparent");
    expect(cls()).not.toContain("text-text-secondary");
  });
});

describe("로딩 원 (I-wrap-b1 ε 8)", () => {
  it("옛 Spinner 대신 ds Progress Circle — 16 · 글자색을 따르고 버튼이 aria-busy 로 알린다", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const r = createRoot(host);
    act(() => r.render(<Button loading>저장</Button>));
    const circle = host.querySelector<HTMLElement>(
      "[data-slot=progress-circle]",
    );
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute("aria-hidden")).toBe("true");
    expect(circle!.getAttribute("data-tone")).toBe("inherit");
    expect(circle!.getAttribute("class")).toContain("[--progress-size:16px]");
    expect(host.querySelector("button")!.getAttribute("aria-busy")).toBe(
      "true",
    );
    act(() => r.unmount());
    host.remove();
  });
});
