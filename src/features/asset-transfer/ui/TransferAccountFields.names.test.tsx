// 이체 모드의 출금 · 입금 계좌 선택 칸은 보이는 라벨로 이름을 받는다(이름 없는 콤보박스 — 거래 추가 시트 이체 모드)
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { TransferAccountFields } = await import("./TransferAccountFields");

describe("TransferAccountFields 선택 칸 이름", () => {
  it("두 콤보박스 모두 라벨 글로 이름을 받는다", () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <TransferAccountFields
          assets={[]}
          fromAssetRowId={null}
          toAssetRowId={null}
          fee=""
          interest=""
          amountNumber={0}
          onFromChange={() => {}}
          onToChange={() => {}}
          onFeeChange={() => {}}
          onInterestChange={() => {}}
        />,
      ),
    );
    const boxes = [...container.querySelectorAll("[role=combobox]")];
    expect(boxes).toHaveLength(2);
    const names = boxes.map((box) =>
      box
        .getAttribute("aria-labelledby")!
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim(),
    );
    expect(names[0]).toContain("addTx.fromAccount");
    expect(names[1]).toContain("addTx.toAccount");
    act(() => root.unmount());
    container.remove();
  });
});
