// Skeleton · LoadingRegion · LoadingAnnouncer 의 동작 — 면 색 · 모서리는 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 시간표(1초 · 5초 · 10초)는 가짜 시계로 센다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { LoadingAnnouncer, LoadingRegion, Skeleton } from "./skeleton";
import { LOADING_TIMING } from "./skeleton-variants";
import { useWaitPhase } from "./use-wait-phase";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const WAITING_TEXT = "불러오는 중…";
const SLOW_TEXT = "평소보다 오래 걸리고 있어요.";

let container: HTMLDivElement;
let root: Root;
let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // 개발 중 알림(LoadingAnnouncer 없음 · 10초 넘김)은 여기서 받아 둔다 — 알림을 보는 테스트만 꺼내 본다
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const region = () =>
  container.querySelector<HTMLElement>("[data-slot=loading-region]")!;
const status = () =>
  document.body.querySelector<HTMLElement>("[data-slot=loading-announcer]");

describe("Skeleton", () => {
  it("늘 보조 기술에 숨긴 블록 span — 기본 모서리 8, 크기는 className", () => {
    const el = render(<Skeleton aria-hidden={false} className="w-[80px]" />);
    expect(el.tagName).toBe("SPAN");
    // 부르는 쪽이 aria-hidden 을 바꿔도 숨긴다 — 회색 면에는 읽을 것이 없다
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.dataset.slot).toBe("skeleton");
    expect(el.dataset.radius).toBe("8");
    expect(el.className).toContain("rounded-r2");
    expect(el.className).toContain("bg-bg-neutral-weak");
    expect(el.className).toContain("w-[80px]");
    // 띠 — 면 위를 지나가고, 모션 줄이기면 멈추고 지운다
    const shimmer = el.querySelector("[data-slot=skeleton-shimmer]")!;
    expect(shimmer.className).toContain("animate-[shimmer_");
    expect(shimmer.className).toContain("motion-reduce:animate-none");
    expect(shimmer.className).toContain("motion-reduce:opacity-0");
  });

  it("모서리 — 0 · 4 · 6 · 8 · 12 · 16 · full", () => {
    const cases = [
      ["0", "rounded-none"],
      ["4", "rounded-r1"],
      ["6", "rounded-r1_5"],
      ["8", "rounded-r2"],
      ["12", "rounded-r3"],
      ["16", "rounded-r4"],
      ["full", "rounded-full"],
    ] as const;
    for (const [radius, cls] of cases) {
      const el = render(<Skeleton radius={radius} />);
      expect(el.dataset.radius).toBe(radius);
      expect(el.className).toContain(cls);
    }
  });

  it("글 자리는 그 글자의 줄 높이를 높이로 — 글 자리(p) 안에도 둘 수 있다", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = render(
      <p>
        <Skeleton text="t5" className="w-[128px]" />
      </p>,
    );
    const el = p.firstElementChild as HTMLElement;
    expect(el.dataset.text).toBe("t5");
    expect(el.className).toContain("h-(--text-t5--line-height)");
    // span 이라 p 안에 둬도 잘못 넣었다는 경고가 없다
    expect(error).not.toHaveBeenCalled();
  });
});

describe("LoadingRegion 없이 그린 Skeleton(화면 82곳 — I-wrap-b5 3-a)", () => {
  it("0 ~ 1초는 보이지 않게(높이는 그대로) 두고 1초에 보인다", () => {
    render(<Skeleton className="h-[20px] w-[100px]" />);
    const el = container.querySelector<HTMLElement>("[data-slot=skeleton]")!;
    expect(el.className).toContain("opacity-0");
    expect(el.getAttribute("data-wait")).toBe("quiet");
    advance(LOADING_TIMING.showAfter - 1);
    expect(el.className).toContain("opacity-0");
    advance(1);
    expect(el.className).not.toContain("opacity-0");
    expect(el.getAttribute("data-wait")).toBe("waiting");
  });

  it("앱의 상태 글이 1초 '불러오는 중…' · 5초 오래 걸림 글을 읽고 사라지면 비운다", () => {
    const tree = (shown: boolean) => (
      <LoadingAnnouncer>{shown && <Skeleton />}</LoadingAnnouncer>
    );
    render(tree(true));
    const el = status()!;
    advance(LOADING_TIMING.showAfter - 1);
    expect(el.textContent).toBe("");
    advance(1);
    expect(el.textContent).toBe(WAITING_TEXT);
    advance(LOADING_TIMING.slowAfter - LOADING_TIMING.showAfter);
    expect(el.textContent).toBe(SLOW_TEXT);
    render(tree(false));
    expect(el.textContent).toBe("");
  });

  it("1초 안에 사라지면 아무것도 읽지 않는다", () => {
    const tree = (shown: boolean) => (
      <LoadingAnnouncer>{shown && <Skeleton />}</LoadingAnnouncer>
    );
    render(tree(true));
    advance(200);
    render(tree(false));
    advance(LOADING_TIMING.slowAfter);
    expect(status()!.textContent).toBe("");
  });

  it("스켈레톤이 열 개여도 같은 글은 한 번만 넣는다", () => {
    render(
      <LoadingAnnouncer>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </LoadingAnnouncer>,
    );
    const el = status()!;
    advance(LOADING_TIMING.showAfter);
    expect(el.textContent).toBe(WAITING_TEXT);
  });
});

describe("스켈레톤만 그리는 영역(pending · fallback — 화면 82곳, I-wrap-b5)", () => {
  const area = (id: string) => (
    <LoadingRegion
      pending
      className="contents"
      fallback={<Skeleton data-testid={id} />}
    />
  );

  it("기다리는 동안 aria-busy, className 을 주면 그 상자가 곧 레이아웃 — contents 로 상자를 만들지 않을 수 있다", () => {
    render(
      <>
        <LoadingRegion
          pending
          className="contents"
          data-testid="a"
          fallback={<Skeleton />}
        />
        <LoadingRegion
          pending
          data-testid="b"
          className="flex gap-x3"
          fallback={<Skeleton />}
        />
      </>,
    );
    const a = document.querySelector<HTMLElement>("[data-testid=a]")!;
    const b = document.querySelector<HTMLElement>("[data-testid=b]")!;
    expect(a.getAttribute("aria-busy")).toBe("true");
    expect(a.className).toContain("contents");
    expect(b.className).toContain("flex gap-x3");
  });

  it("5초 글은 한 화면에 한 번 — 영역이 여럿이어도 문서 순서로 맨 위 영역에만 글이 뜬다(나머지는 aria-busy 만)", () => {
    render(
      <>
        <section>{area("a")}</section>
        <section>{area("b")}</section>
        <section>{area("c")}</section>
      </>,
    );
    advance(LOADING_TIMING.slowAfter - 1);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    advance(1);
    const notes = container.querySelectorAll("p");
    expect(notes).toHaveLength(1);
    expect(notes[0]!.textContent).toBe(SLOW_TEXT);
    expect(container.querySelector("section")!.contains(notes[0]!)).toBe(true);
    expect(container.querySelectorAll("[aria-busy=true]")).toHaveLength(3);
  });

  it("맨 위 영역이 끝나면 다음 영역이 글을 이어받는다", () => {
    const tree = (first: boolean) => (
      <>
        {first && <section>{area("a")}</section>}
        <section>{area("b")}</section>
      </>
    );
    render(tree(true));
    advance(LOADING_TIMING.slowAfter);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    render(tree(false));
    advance(1);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("useWaitPhase", () => {
  const Probe = ({ pending }: { pending: boolean }) => (
    <span>{useWaitPhase(pending)}</span>
  );

  it("0 ~ 1초 quiet · 1초부터 waiting · 5초부터 slow — 끝나면 quiet, 다시 기다리면 처음부터", () => {
    const el = render(<Probe pending />);
    expect(el.textContent).toBe("quiet");
    advance(LOADING_TIMING.showAfter - 1);
    expect(el.textContent).toBe("quiet");
    advance(1);
    expect(el.textContent).toBe("waiting");
    advance(LOADING_TIMING.slowAfter - LOADING_TIMING.showAfter - 1);
    expect(el.textContent).toBe("waiting");
    advance(1);
    expect(el.textContent).toBe("slow");

    render(<Probe pending={false} />);
    expect(el.textContent).toBe("quiet");
    render(<Probe pending />);
    // 지난 기다림의 slow 를 잇지 않는다
    expect(el.textContent).toBe("quiet");
    advance(LOADING_TIMING.showAfter);
    expect(el.textContent).toBe("waiting");
  });
});

describe("LoadingRegion", () => {
  const rows = <Skeleton text="t5" className="w-[128px]" />;

  it("0 ~ 1초 — 대체 모습을 보이지 않게 그려 높이를 지키고, 영역에 aria-busy", () => {
    render(
      <LoadingRegion pending fallback={rows}>
        내용
      </LoadingRegion>,
    );
    const el = region();
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.dataset.state).toBe("quiet");
    expect(el.className).toContain("[&>*]:invisible");
    expect(el.querySelector("[data-slot=skeleton]")).not.toBeNull();
    expect(el.textContent).not.toContain("내용");
    expect(el.querySelector("p")).toBeNull();
  });

  it("1초 — 스켈레톤이 보이고, 5초 — 첫 스켈레톤 위에 오래 걸림 글 한 줄", () => {
    render(<LoadingRegion pending fallback={rows} />);
    advance(LOADING_TIMING.showAfter);
    expect(region().dataset.state).toBe("waiting");
    expect(region().className).not.toContain("invisible");
    expect(region().querySelector("p")).toBeNull();

    advance(LOADING_TIMING.slowAfter - LOADING_TIMING.showAfter);
    const el = region();
    expect(el.dataset.state).toBe("slow");
    const slow = el.firstElementChild as HTMLElement;
    expect(slow.tagName).toBe("P");
    expect(slow.textContent).toBe(SLOW_TEXT);
    // t4 · 400 · fg-neutral-muted, 첫 스켈레톤 위 16 · 왼쪽 맞춤, 단어 단위 줄바꿈
    for (const cls of [
      "text-t4",
      "font-normal",
      "text-fg-neutral-muted",
      "mb-x4",
      "break-keep",
    ]) {
      expect(slow.className).toContain(cls);
    }
    // 스켈레톤은 그대로
    expect(slow.nextElementSibling?.getAttribute("data-slot")).toBe("skeleton");
  });

  it("원 모드 — 영역 가운데 Progress Circle 40, 5초부터 원 아래 가운데 글", () => {
    render(<LoadingRegion pending fallback="circle" />);
    const el = region();
    expect(el.dataset.fallback).toBe("circle");
    expect(el.className).toContain("items-center");
    const circle = el.querySelector("[data-slot=progress-circle]")!;
    expect(circle.getAttribute("role")).toBe("progressbar");
    expect(circle.getAttribute("data-size")).toBe("40");

    advance(LOADING_TIMING.slowAfter);
    const slow = circle.nextElementSibling as HTMLElement;
    expect(slow.tagName).toBe("P");
    expect(slow.textContent).toBe(SLOW_TEXT);
    expect(slow.className).toContain("mt-x4");
    expect(slow.className).toContain("text-center");
  });

  it("다 오면 aria-busy 를 풀고 내용이 투명도로 나타난다", () => {
    render(<LoadingRegion pending fallback={rows} />);
    advance(LOADING_TIMING.showAfter);
    render(
      <LoadingRegion pending={false} fallback={rows}>
        내용
      </LoadingRegion>,
    );
    const el = region();
    expect(el.hasAttribute("aria-busy")).toBe(false);
    expect(el.dataset.state).toBe("ready");
    expect(el.textContent).toBe("내용");
    expect(el.querySelector("[data-slot=skeleton]")).toBeNull();
    expect(el.className).toContain("animate-[fade-in_");
    expect(el.className).toContain("motion-reduce:animate-none");
  });

  it("처음부터 내용이 있으면(받아 둔 것) 그대로 — 나타나는 움직임이 없다", () => {
    render(
      <LoadingRegion pending={false} fallback={rows}>
        내용
      </LoadingRegion>,
    );
    expect(region().dataset.state).toBe("ready");
    expect(region().className).not.toContain("fade-in");
  });

  it("내용 없이 실패하면 failure 를 그리고 aria-busy 를 푼다 — 다시 기다리면 시간표를 처음부터 센다", () => {
    render(
      <LoadingRegion pending fallback={rows} failure={<b>실패</b>}>
        내용
      </LoadingRegion>,
    );
    advance(LOADING_TIMING.slowAfter);
    expect(region().dataset.state).toBe("slow");

    // pending 이 남아 있어도 실패가 앞선다
    render(
      <LoadingRegion pending failed fallback={rows} failure={<b>실패</b>}>
        내용
      </LoadingRegion>,
    );
    let el = region();
    expect(el.dataset.state).toBe("failed");
    expect(el.hasAttribute("aria-busy")).toBe(false);
    expect(el.textContent).toBe("실패");
    expect(el.querySelector("[data-slot=skeleton]")).toBeNull();

    // 다시 시도 — 지난 기다림의 slow 를 잇지 않는다
    render(
      <LoadingRegion pending fallback={rows} failure={<b>실패</b>}>
        내용
      </LoadingRegion>,
    );
    el = region();
    expect(el.dataset.state).toBe("quiet");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.querySelector("p")).toBeNull();
  });

  it("개발 중 — 요청 제한(10초)이 지나고도 1초 넘게 pending 이면 알린다", () => {
    render(
      <LoadingAnnouncer>
        <LoadingRegion pending fallback={rows} />
      </LoadingAnnouncer>,
    );
    const timedOut = () =>
      warn.mock.calls.filter(([m]) => String(m).includes("pending 이다"));
    advance(LOADING_TIMING.timeout + 999);
    expect(timedOut()).toHaveLength(0);
    advance(1);
    expect(timedOut()).toHaveLength(1);
    expect(String(timedOut()[0]![0])).toContain("11초");
  });

  it("개발 중 — LoadingAnnouncer 가 없으면 한 번만 알린다", async () => {
    // 한 번만 알리는 표시는 모듈에 남으므로 새로 불러온 모듈로 본다
    vi.resetModules();
    const fresh = await import("./skeleton");
    render(
      <>
        <fresh.LoadingRegion pending fallback={rows} />
        <fresh.LoadingRegion pending fallback={rows} />
      </>,
    );
    const missing = warn.mock.calls.filter(([m]) =>
      String(m).includes("LoadingAnnouncer"),
    );
    expect(missing).toHaveLength(1);
  });
});

describe("LoadingAnnouncer", () => {
  it("상태 글은 body 끝에 하나 — 처음엔 비어 있고, 1초 '불러오는 중…' · 5초 오래 걸림 글, 다 오면 비운다", () => {
    const tree = (pending: boolean) => (
      <LoadingAnnouncer>
        <LoadingRegion pending={pending} fallback={<Skeleton />}>
          내용
        </LoadingRegion>
      </LoadingAnnouncer>
    );
    render(tree(true));
    const el = status()!;
    expect(el.parentElement).toBe(document.body);
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(el.className).toContain("sr-only");
    // 상태 글은 영역보다 먼저 있어야 읽힌다 — 빈 채로 둔다
    expect(el.textContent).toBe("");

    advance(LOADING_TIMING.showAfter);
    expect(el.textContent).toBe(WAITING_TEXT);
    advance(LOADING_TIMING.slowAfter - LOADING_TIMING.showAfter);
    expect(el.textContent).toBe(SLOW_TEXT);

    render(tree(false));
    expect(el.textContent).toBe("");
    expect(
      document.body.querySelectorAll("[data-slot=loading-announcer]"),
    ).toHaveLength(1);
  });

  it("영역이 여럿이어도 같은 글은 한 번만 — 오래 걸리던 영역이 끝나도 '불러오는 중…' 으로 돌아가지 않는다", () => {
    // render 마다 LoadingAnnouncer 도 다시 그려진다 — 알릴 곳이 바뀌면 영역의 효과가 다시 돌며 이미 넣은 글을 잊어
    // 아래의 마지막 단계에서 "불러오는 중…" 으로 돌아간다
    const tree = (a: boolean, b: boolean) => (
      <LoadingAnnouncer>
        <LoadingRegion pending={a} fallback={<Skeleton />} />
        <LoadingRegion pending={b} fallback={<Skeleton />} />
      </LoadingAnnouncer>
    );
    render(tree(true, false));
    const el = status()!;
    advance(LOADING_TIMING.showAfter); // A 1초
    expect(el.textContent).toBe(WAITING_TEXT);
    advance(3500); // A 4.5초
    render(tree(true, true)); // B 가 기다리기 시작
    advance(LOADING_TIMING.slowAfter - 4500); // A 5초 — 오래 걸림
    expect(el.textContent).toBe(SLOW_TEXT);
    advance(LOADING_TIMING.showAfter); // B 1초
    expect(el.textContent).toBe(SLOW_TEXT);

    render(tree(false, true)); // A 가 끝났고 B 는 1 ~ 5초
    expect(el.textContent).toBe(SLOW_TEXT);
    advance(LOADING_TIMING.slowAfter); // B 도 오래 걸림 — 이미 넣은 글
    expect(el.textContent).toBe(SLOW_TEXT);

    render(tree(false, false));
    expect(el.textContent).toBe("");

    // 다 온 뒤의 새 기다림은 처음부터 — 다시 "불러오는 중…"
    render(tree(true, false));
    expect(el.textContent).toBe("");
    advance(LOADING_TIMING.showAfter);
    expect(el.textContent).toBe(WAITING_TEXT);
  });
});
