// 필터 시트 › 계좌 · 카드 줄의 앞 타일은 ds Logo Tile 40 이다 — 자산 목록 줄(AssetRow)과 같은 부품(logo-tile.md, I-wrap-b1 ε 8).
// 종전엔 손으로 짠 AssetLogo(모서리 --radius-tile · 글자 800)였다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { FilterAssetBody } = await import("./FilterAssetBody");

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

const asset = (rowId: number, assetName: string, institution: string | null) =>
  ({ rowId, assetName, institution, color: null }) as unknown as Asset;

describe("계좌 · 카드 줄 앞 타일 (I-wrap-b1 ε 8)", () => {
  it("줄마다 Logo Tile 40 — 기관이 있으면 기관 면, 없으면 이름 면", () => {
    act(() =>
      root.render(
        <FilterAssetBody
          assets={[asset(1, "월급 통장", "신한"), asset(2, "비상금", null)]}
          value={{ include: [], exclude: [] }}
          onChange={() => {}}
        />,
      ),
    );
    const tiles = [
      ...container.querySelectorAll<HTMLElement>("[data-slot=logo-tile]"),
    ];
    expect(tiles).toHaveLength(2);
    expect(tiles[0]!.dataset.face).toBe("institution");
    expect(tiles[1]!.dataset.face).toBe("name");
    expect(tiles[0]!.textContent).toBe("신");
    expect(tiles[1]!.textContent).toBe("비");
  });

  it("기관 이름이 공백뿐이면 자산 이름 면 · 둘 다 비면 글자 없는 기본 타일(검수 L8)", () => {
    act(() =>
      root.render(
        <FilterAssetBody
          assets={[asset(1, "여행 통장", "   "), asset(2, "  ", null)]}
          value={{ include: [], exclude: [] }}
          onChange={() => {}}
        />,
      ),
    );
    const tiles = [
      ...container.querySelectorAll<HTMLElement>("[data-slot=logo-tile]"),
    ];
    expect(tiles[0]!.dataset.face).toBe("name");
    expect(tiles[0]!.textContent).toBe("여");
    expect(tiles[1]!.textContent).toBe("");
  });
});
