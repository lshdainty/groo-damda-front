// Result Section 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, type ReactNode, type SVGProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultSection } from "./result-section";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
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
  return container.firstElementChild as HTMLElement;
}

// 한 프레임 넘긴다 — 처음 한 프레임은 내용을 감춘다
const nextFrame = () => act(() => vi.advanceTimersByTime(20));

const slot = (name: string) =>
  container.querySelector<HTMLElement>(`[data-slot=${name}]`);

// 받은 속성(data-testid 등)을 펼친다 — 버튼 앞 아이콘을 다른 이름으로 구별해 잰다
const Receipt = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="receipt" {...props} />
);

describe("ResultSection", () => {
  it("기본은 empty · large — role=status 묶음, 제목은 h2", () => {
    const box = render(
      <ResultSection icon={<Receipt />} title="이번 달 거래가 없어요" />,
    );
    expect(box.getAttribute("role")).toBe("status");
    expect(box.dataset.kind).toBe("empty");
    expect(box.dataset.size).toBe("large");
    const title = slot("result-section-title")!;
    expect(title.tagName).toBe("H2");
    expect(title.textContent).toBe("이번 달 거래가 없어요");
  });

  it("처음 한 프레임은 내용을 감췄다가 보인다 — status 에 나중에 들어온 내용이어야 읽힌다", () => {
    const box = render(
      <ResultSection icon={<Receipt />} title="이번 달 거래가 없어요" />,
    );
    expect(box.className).toContain("[&>*]:invisible");
    nextFrame();
    expect(box.className).not.toContain("[&>*]:invisible");
  });

  it("제목 태그는 as 로 그 화면의 제목 단계에 맞춘다", () => {
    render(
      <ResultSection
        as="h1"
        icon={<Receipt />}
        title="페이지를 찾을 수 없어요"
      />,
    );
    expect(slot("result-section-title")!.tagName).toBe("H1");
  });

  it("아이콘은 장식 — empty 는 준 아이콘, failure · done 은 주지 않으면 느낌표 · 체크", () => {
    render(<ResultSection icon={<Receipt />} title="비어 있어요" />);
    const asset = slot("result-section-asset")!;
    expect(asset.getAttribute("aria-hidden")).toBe("true");
    expect(asset.querySelector("[data-testid=receipt]")).not.toBeNull();
    expect(asset.className).toContain("text-fg-neutral-subtle");

    act(() =>
      root.render(<ResultSection kind="failure" title="불러오지 못했어요" />),
    );
    expect(slot("result-section-asset")!.className).toContain(
      "text-fg-critical",
    );
    expect(
      slot("result-section-asset")!.querySelector("svg")!.getAttribute("class"),
    ).toContain("circle-alert");

    act(() => root.render(<ResultSection kind="done" title="가져왔어요" />));
    expect(slot("result-section-asset")!.className).toContain(
      "text-fg-positive",
    );
    expect(
      slot("result-section-asset")!.querySelector("svg")!.getAttribute("class"),
    ).toContain("circle-check");
  });

  it("크기마다 제목 · 설명 글자와 사이, 버튼 위가 다르다", () => {
    const actions = { primaryAction: { label: "다시 시도" } };
    render(
      <ResultSection
        kind="failure"
        title="문제가 생겼어요"
        description="잠시 뒤 다시 시도해 주세요."
        {...actions}
      />,
    );
    expect(slot("result-section-title")!.className).toContain("text-t8");
    expect(slot("result-section-description")!.className).toContain("mt-x3");
    expect(slot("result-section-description")!.className).toContain("text-t5");
    expect(slot("result-section-actions")!.className).toContain("mt-x7");

    act(() =>
      root.render(
        <ResultSection
          kind="failure"
          size="medium"
          title="거래를 불러오지 못했어요"
          description="잠시 뒤 다시 시도해 주세요."
          {...actions}
        />,
      ),
    );
    expect(slot("result-section-title")!.className).toContain("text-t5");
    expect(slot("result-section-description")!.className).toContain("mt-x2");
    expect(slot("result-section-description")!.className).toContain("text-t4");
    expect(slot("result-section-actions")!.className).toContain("mt-x6");
  });

  it("설명 · 버튼이 없으면 그 자리를 그리지 않는다", () => {
    render(<ResultSection kind="done" title="가져왔어요" />);
    expect(slot("result-section-description")).toBeNull();
    expect(slot("result-section-actions")).toBeNull();
  });

  it("첫 버튼은 neutralWeak medium 40, 둘째는 ghost small 36 + 위아래 −8 블리드", () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <ResultSection
        kind="done"
        title="1,204건을 가져왔어요"
        primaryAction={{ label: "가계부로 가기", onClick: onPrimary }}
        secondaryAction={{ label: "다른 파일 가져오기", onClick: onSecondary }}
      />,
    );
    const [primary, secondary] = Array.from(
      slot("result-section-actions")!.children,
    ) as HTMLButtonElement[];
    expect(primary!.tagName).toBe("BUTTON");
    expect(primary!.getAttribute("type")).toBe("button");
    expect(primary!.className).toContain("bg-bg-neutral-weak");
    expect(primary!.className).toContain("h-[40px]");
    expect(secondary!.className).toContain("bg-transparent");
    expect(secondary!.className).toContain("h-[36px]");
    expect(secondary!.className).toContain("-my-x2");
    expect(secondary!.className).toContain("text-fg-neutral-muted");
    act(() => primary!.click());
    act(() => secondary!.click());
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("href 를 주면 링크로 그린다(Button asChild)", () => {
    render(
      <ResultSection
        icon={<Receipt />}
        title="페이지를 찾을 수 없어요"
        primaryAction={{ label: "홈으로", href: "/" }}
      />,
    );
    const link = slot("result-section-actions")!.firstElementChild!;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/");
    expect(link.className).toContain("bg-bg-neutral-weak");
  });

  it("다시 시도 하는 동안은 버튼에 로딩을 건다 — aria-busy, 누르기를 삼킨다", () => {
    const onRetry = vi.fn();
    render(
      <ResultSection
        kind="failure"
        title="거래를 불러오지 못했어요"
        primaryAction={{ label: "다시 시도", onClick: onRetry, loading: true }}
      />,
    );
    const retry = slot("result-section-actions")!
      .firstElementChild as HTMLButtonElement;
    expect(retry.getAttribute("aria-busy")).toBe("true");
    act(() => retry.click());
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("ref · 나머지 속성은 묶음에 닿는다", () => {
    const ref = createRef<HTMLDivElement>();
    const box = render(
      <ResultSection
        ref={ref}
        id="empty-ledger"
        icon={<Receipt />}
        title="이번 달 거래가 없어요"
      />,
    );
    expect(ref.current).toBe(box);
    expect(box.id).toBe("empty-ledger");
  });

  it("버튼 앞 아이콘(icon) — 새로 만드는 동작에만, 글 앞에 놓인다", () => {
    render(
      <ResultSection
        icon={<Receipt />}
        title="저장된 프리셋이 없어요"
        primaryAction={{
          label: "프리셋 추가",
          icon: <Receipt data-testid="plus" />,
          onClick: () => {},
        }}
      />,
    );
    const btn = slot("result-section-actions")!
      .firstElementChild as HTMLElement;
    expect(btn.firstElementChild?.getAttribute("data-testid")).toBe("plus");
    expect(btn.textContent).toBe("프리셋 추가");
  });
});
