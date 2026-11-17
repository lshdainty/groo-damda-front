// 딤이 열린 동안 body 바탕색을 딤 토큰으로(src/index.css) — iPhone Safari 26 에서 키보드 위 띠는 body 의 바탕색으로 칠해지고
// fixed 딤도 body 의 background-image 도 닿지 않는다(2026-11-18 QA 실기기). 실제 띠의 색은 실기기로만 본다 — 여기서는 index.css 의
// 규칙 글을 그대로 읽어 (1) 실제 시트 · Menu Sheet 와 같은 시트 · 대화상자 · 확인창 · 처리 중 딤이 열리고 닫히고 겹칠 때 그 선택자가
// 맞는지, (2) 바탕색이 딤 토큰 그대로이고 색을 새로 만들지 않는지, (3) 다크는 딤과 같은 조건으로 다크 딤인지, (4) 반투명 바탕색이
// 겹쳐 그려지는 html 바탕이 body 원래 바탕과 같은지(라이트 · 다크)를 잠근다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { Dialog, DialogBody, DialogContent } from "@/shared/ds/dialog";
import { BusyOverlay } from "@/shared/ui/groo/busy-overlay";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const indexCss = readFileSync("src/index.css", "utf-8");

// body 에 딤을 까는 두 규칙 — 라이트(body) · 다크(body:is(.dark *))
const RULES = [
  ...indexCss.matchAll(
    /\n {2}(:root:has\([\s\S]*?\)\s*body(?::is\(\.dark \*\))?)\s*\{([^}]*)\}/g,
  ),
].map((m) => ({
  selector: m[1]!.replace(/\s+/g, " ").trim(),
  body: m[2]!.replace(/\s+/g, " ").trim(),
}));
const light = RULES.find((r) => !r.selector.endsWith(":is(.dark *)"));
const dark = RULES.find((r) => r.selector.endsWith(":is(.dark *)"));

// html 의 표식 부분(:root:has(…)) — 열린 딤이 있으면 html 이 맞는다
const markerOf = (selector: string) =>
  selector.replace(/\s*body(?::is\(\.dark \*\))?$/, "");
const dimmed = () =>
  document.documentElement.matches(markerOf(light!.selector)) &&
  document.body.matches(light!.selector);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
  // 1280 미만(시트) — jsdom 에는 matchMedia 가 없다
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  document.documentElement.classList.remove("dark");
  vi.useRealTimers();
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
// 사라지는 모션을 jsdom 은 끝내지 않는다 — 끝났다고 알려 표면을 치운다
const settle = () =>
  act(async () => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-state=closed]",
    )) {
      const e = new Event("animationend", { bubbles: true });
      Object.assign(e, { animationName: getComputedStyle(el).animationName });
      el.dispatchEvent(e);
    }
    await new Promise((r) => setTimeout(r, 0));
  });

const dim = (slot: string) =>
  document.querySelector<HTMLElement>(`[data-slot=${slot}]`);

function Sheet({ open, children }: { open: boolean; children?: ReactNode }) {
  return (
    <BottomSheet open={open} onOpenChange={() => {}}>
      <BottomSheetContent title="기간">
        <BottomSheetBody>
          <input aria-label="메모" />
        </BottomSheetBody>
        {children}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function Ask({ open }: { open: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogTitle>그만 쓸까요?</AlertDialogTitle>
        <AlertDialogDescription>쓰던 내용은 사라져요.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>계속 쓰기</AlertDialogCancel>
          <AlertDialogAction>그만 쓰기</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("index.css — 딤이 열린 동안 body 바탕에 딤 한 겹", () => {
  it("규칙은 라이트 · 다크 두 벌이고, body 바탕색을 딤 토큰 그대로 둔다 — 색 값을 새로 만들지 않는다", () => {
    expect(RULES).toHaveLength(2);
    expect(light!.body).toBe("background-color: var(--overlay-dim-light);");
    expect(dark!.body).toBe("background-color: var(--overlay-dim-dark);");
    for (const r of RULES) {
      // Safari 는 띠에 background-image 를 그리지 않는다(QA 실기기) — 바탕색만 쓴다
      expect(r.body).not.toMatch(/background-image|gradient/);
      expect(r.body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix/i);
    }
    // 다크 조건은 딤의 dark: 와 같다(@custom-variant dark — .dark 의 자손)
    expect(indexCss).toContain("@custom-variant dark (&:is(.dark *));");
    expect(markerOf(dark!.selector)).toBe(markerOf(light!.selector));
  });

  it("아무 것도 열리지 않으면 걸지 않는다", () => {
    render(<p>뒤 화면</p>);
    expect(dimmed()).toBe(false);
  });

  it("시트(Menu Sheet 도 같은 시트 딤) — 열리면 걸고, 닫힘이 시작되면(data-state=closed) 바로 걷는다", async () => {
    render(<Sheet open />);
    await tick();
    expect(dim("bottom-sheet-overlay")?.parentElement).toBe(document.body);
    expect(dim("bottom-sheet-overlay")?.getAttribute("data-state")).toBe(
      "open",
    );
    expect(dimmed()).toBe(true);

    render(<Sheet open={false} />);
    await tick();
    // 딤이 사라지는 중(아직 붙어 있다)에도 이미 걷혔다 — 키보드 위 띠가 사라지는 딤보다 늦게 남지 않는다
    expect(dim("bottom-sheet-overlay")?.getAttribute("data-state")).toBe(
      "closed",
    );
    expect(dimmed()).toBe(false);
    await settle();
    expect(dim("bottom-sheet-overlay")).toBeNull();
    expect(dimmed()).toBe(false);
  });

  it("대화상자 — 열리면 걸고 닫으면 걷는다", async () => {
    const Box = ({ open }: { open: boolean }) => (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent title="메모" size="medium">
          <DialogBody>본문</DialogBody>
        </DialogContent>
      </Dialog>
    );
    render(<Box open />);
    await tick();
    expect(dim("dialog-overlay")?.parentElement).toBe(document.body);
    expect(dimmed()).toBe(true);
    render(<Box open={false} />);
    await tick();
    expect(dimmed()).toBe(false);
  });

  it("확인창 — 열리면 걸고 닫으면 걷는다", async () => {
    render(<Ask open />);
    await tick();
    expect(dim("alert-dialog-overlay")?.parentElement).toBe(document.body);
    expect(dimmed()).toBe(true);
    render(<Ask open={false} />);
    await tick();
    expect(dimmed()).toBe(false);
  });

  it("겹친 표면(시트 위 확인창) — 위 표면이 닫혀도 남고, 마지막 표면이 닫힐 때만 걷는다", async () => {
    const Both = ({ sheet, ask }: { sheet: boolean; ask: boolean }) => (
      <>
        <Sheet open={sheet} />
        <Ask open={ask} />
      </>
    );
    render(<Both sheet ask />);
    await tick();
    expect(dimmed()).toBe(true);

    render(<Both sheet ask={false} />);
    await tick();
    expect(dimmed()).toBe(true);
    await settle();
    expect(dim("alert-dialog-overlay")).toBeNull();
    expect(dimmed()).toBe(true);

    render(<Both sheet={false} ask={false} />);
    await tick();
    expect(dimmed()).toBe(false);
  });

  it("시트 위 시트(겹친 시트) — 위 시트가 닫혀도 아래 시트 딤으로 남는다", async () => {
    const Nested = ({ inner }: { inner: boolean }) => (
      <Sheet open>
        <Sheet open={inner} />
      </Sheet>
    );
    render(<Nested inner />);
    await tick();
    expect(
      document.querySelectorAll("[data-slot=bottom-sheet-overlay]"),
    ).toHaveLength(2);
    expect(dimmed()).toBe(true);
    render(<Nested inner={false} />);
    await tick();
    await settle();
    expect(dimmed()).toBe(true);
  });

  it("처리 중(BusyOverlay) — 1초 전 투명 막에는 걸지 않고, 딤이 보일 때부터 걸고, 끝나면 걷는다", () => {
    vi.useFakeTimers();
    render(<BusyOverlay busy label="해지하는 중" />);
    expect(dim("busy-overlay")?.parentElement).toBe(document.body);
    expect(dimmed()).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(dim("busy-overlay")?.hasAttribute("data-visible")).toBe(true);
    expect(dimmed()).toBe(true);
    render(<BusyOverlay busy={false} label="해지하는 중" />);
    expect(dimmed()).toBe(false);
  });

  it("다크 — html 이 .dark 면 다크 규칙이 맞는다(라이트 규칙 뒤 · 더 구체적이라 이긴다)", async () => {
    document.documentElement.classList.add("dark");
    render(<Sheet open />);
    await tick();
    expect(document.body.matches(dark!.selector)).toBe(true);
    expect(RULES.indexOf(dark!)).toBeGreaterThan(RULES.indexOf(light!));
    document.documentElement.classList.remove("dark");
    expect(document.body.matches(dark!.selector)).toBe(false);
    expect(document.body.matches(light!.selector)).toBe(true);
  });

  it("카탈로그 무대 안의 비모달 견본(body 바로 아래가 아니다)은 세지 않는다", async () => {
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    render(
      <BottomSheet open modal={false} container={stage}>
        <BottomSheetContent title="견본">
          <BottomSheetBody>본문</BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>,
    );
    await tick();
    expect(dim("bottom-sheet-overlay")?.getAttribute("data-state")).toBe(
      "open",
    );
    expect(dimmed()).toBe(false);
    act(() => root.unmount());
    root = createRoot(container);
    stage.remove();
  });
});

describe("반투명 바탕색이 겹치는 html 바탕 = body 원래 바탕(라이트 · 다크) — 그래야 띠가 딤 아래 바탕과 같은 색이다", () => {
  const cssFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? cssFiles(join(dir, e.name))
        : e.name.endsWith(".css")
          ? [join(dir, e.name)]
          : [],
    );

  it("html · body 둘 다 background: var(--bg-canvas) 다", () => {
    expect(indexCss).toMatch(
      /\n {2}html \{[^}]*background: var\(--bg-canvas\);[^}]*\}/,
    );
    expect(indexCss).toMatch(
      /\n {2}body \{[^}]*background: var\(--bg-canvas\);[^}]*\}/,
    );
  });

  it("--bg-canvas 는 한 곳(:root · .dark · [data-theme=dark])에서만 정한다 — html 과 body 가 라이트 · 다크 모두 같은 값을 받는다", () => {
    const defs = cssFiles("src").flatMap((f) =>
      [...readFileSync(f, "utf-8").matchAll(/--bg-canvas:\s*([^;]+);/g)].map(
        (m) => m[1],
      ),
    );
    expect(defs).toEqual(["var(--color-bg-layer-basement)"]);
    expect(indexCss).toMatch(
      /:root,\s*\.dark,\s*\[data-theme="dark"\] \{[^}]*--bg-canvas: var\(--color-bg-layer-basement\);/,
    );
  });

  it("다른 CSS 는 html · body 의 바탕을 바꾸지 않는다", () => {
    for (const f of cssFiles("src")) {
      const css = readFileSync(f, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1]!.trim();
        if (!/(^|[\s,>])(html|body)\b/.test(selector)) continue;
        if (!/background/.test(m[2]!)) continue;
        const allowed =
          f.endsWith("index.css") &&
          (/^(html|body)$/.test(selector) || selector.startsWith(":root:has("));
        expect({ file: f, selector, allowed }).toMatchObject({
          allowed: true,
        });
      }
    }
  });

  it("셸 밖 화면(로그인 등)도 html · body 바탕을 스크립트로 바꾸지 않는다 — 임베드만 body 를 투명하게 둔다(오버레이 없음)", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
            ? [join(dir, e.name)]
            : [],
      );
    const writers = files("src").filter((f) =>
      /(documentElement|body)\.style\.(background|setProperty\(\s*["']background)/.test(
        readFileSync(f, "utf-8"),
      ),
    );
    expect(writers).toEqual([
      join("src", "pages", "stocks", "ui", "EmbedStockChartPage.tsx"),
    ]);
  });
});

describe("키보드가 없을 때 모습은 그대로 — 화면 안의 body 는 앱 틀이 불투명하게 덮는다", () => {
  const grooCss = readFileSync("src/shared/styles/groo.css", "utf-8");
  it("폰 셸(.m-app)은 화면 높이 이상 · 불투명 바탕이다", () => {
    const mApp = grooCss.match(/\n\.m-app \{([^}]*)\}/)![1];
    expect(mApp).toMatch(/min-height: 100dvh;/);
    expect(mApp).toMatch(/background: var\(--bg-surface\);/);
    expect(grooCss).toMatch(
      /\n\.m-app--page \{\s*background: var\(--bg-canvas\);\s*\}/,
    );
  });
});
