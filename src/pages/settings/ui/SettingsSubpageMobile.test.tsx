// 폰 껍데기 임시 24(TEMP_BODY_PADDING) — 목록에 있는 id 만 24 가 되고, 없는 id 는 24 가 아니다(I-16 13).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECTIONS, TEMP_BODY_PADDING, type SectionId } from "../model/sections";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { SettingsSubpageMobile } = await import("./SettingsSubpageMobile");

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
});

function renderWith(id: SectionId) {
  const section = SECTIONS.find((s) => s.id === id)!;
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <SettingsSubpageMobile
          activeSection={section}
          goBack={() => {}}
          onHeadAction={() => {}}
          body={<p id="body">body</p>}
        />
      </QueryClientProvider>,
    ),
  );
  return container.querySelector("#body")!.parentElement!;
}

describe("SettingsSubpageMobile 임시 24", () => {
  it("TEMP_BODY_PADDING 에 있는 id 는 본문이 p-x6 상자에 담긴다", () => {
    for (const id of TEMP_BODY_PADDING) {
      const wrap = renderWith(id);
      expect(wrap.hasAttribute("data-temp-body-padding"), id).toBe(true);
      expect(wrap.className, id).toContain("p-x6");
    }
  });

  it("목록에 없는 id 는 24 가 아니다(본문이 제 여백을 갖는다)", () => {
    const outside = SECTIONS.map((s) => s.id).filter(
      (id) => !TEMP_BODY_PADDING.includes(id),
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const id of outside) {
      const wrap = renderWith(id);
      expect(wrap.hasAttribute("data-temp-body-padding"), id).toBe(false);
      expect(wrap.className, id).not.toContain("p-x6");
    }
  });
});

// 흰 면은 세로 flex 로 화면 바닥까지 늘어난다 — 본문이 flex-1 로 남은 높이를 받아 화면 전체 결과(비어 있음 · 실패)를
// 그 가운데에 세운다(groo-design result-section.md). 폰 셸은 높이가 min-height 뿐이라 % 높이(min-h-full)는 풀리지 않는다 —
// 높이는 flex 늘림으로만 이어진다
describe("SettingsSubpageMobile 흰 면 — 세로 flex", () => {
  it("본문 상자가 세로 flex · 남은 높이 채움이다", () => {
    const outside = SECTIONS.map((s) => s.id).filter(
      (id) => !TEMP_BODY_PADDING.includes(id),
    );
    for (const id of outside) {
      const face = renderWith(id);
      expect(face.getAttribute("data-slot"), id).toBe("settings-subpage-body");
      expect(face.className.split(/\s+/), id).toEqual(
        expect.arrayContaining(["flex", "flex-1", "shrink-0", "flex-col"]),
      );
    }
  });
});
