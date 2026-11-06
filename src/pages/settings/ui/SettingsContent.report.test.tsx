// 틀의 제목 줄 자리를 페이지에 알리는 것은 자리가 바뀔 때만이다 — 틀이 다시 그려질 때마다 null → 자리를 다시 알리면
// 페이지(SettingsPage)가 한 번 더 렌더한다(I-wrap-b1 ε 검수 L3).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECTIONS } from "../model/sections";
import { SettingsHeadSlotReportContext } from "../model/settings-body-host";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("./SettingsBackLink", () => ({ SettingsBackLink: () => null }));

const { SettingsContent } = await import("./SettingsContent");

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

describe("제목 줄 자리 알리기 (I-wrap-b1 ε 검수 L3)", () => {
  it("다시 그려도 한 번만 알린다 — null 을 끼워 다시 알리지 않는다", () => {
    const report = vi.fn();
    const section = SECTIONS.find((s) => s.id === "account")!;
    const draw = (n: number) =>
      act(() =>
        root.render(
          <SettingsHeadSlotReportContext.Provider value={report}>
            <SettingsContent
              activeSection={section}
              back={null}
              renderBody={() => <div data-n={n} />}
            />
          </SettingsHeadSlotReportContext.Provider>,
        ),
      );
    draw(1);
    draw(2);
    draw(3);
    const slot = container.querySelector(".settings-head-slot");
    expect(report.mock.calls).toEqual([[slot]]);
  });
});
