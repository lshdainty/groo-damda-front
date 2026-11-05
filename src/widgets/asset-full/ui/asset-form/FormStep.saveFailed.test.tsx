// 폼 저장 실패 Callout(I-28-5 자산 A) — 폼 맨 위 critical 고정 글, 실패가 아니면 없다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("@/shared/ds/dialog", () => ({
  ResponsiveDialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="body">{children}</div>
  ),
}));
vi.mock("@/shared/ui/groo/form-footer", () => ({ FormFooter: () => null }));
vi.mock("./KindField", () => ({ KindField: () => null }));
vi.mock("./AccountFields", () => ({ AccountFields: () => null }));
vi.mock("./CardFields", () => ({ CardFields: () => null }));
vi.mock("./InvestFields", () => ({ InvestFields: () => null }));
vi.mock("./CheckRows", () => ({ CheckRows: () => null }));
const { FormStep } = await import("./FormStep");

let container: HTMLDivElement;
let root: Root;
const f = {
  t: (k: string) => k,
  tCommon: (k: string) => k,
  isNew: false,
  editingGroup: "account",
  submitTick: 0,
} as never;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FormStep 저장 실패 Callout", () => {
  it("실패면 본문 맨 위에 고정 글 + 맨 위로 끌어온다", () => {
    act(() =>
      root.render(
        <FormStep
          f={f}
          onSubmit={() => {}}
          saveFailed
          saveError={new Error("x")}
        />,
      ),
    );
    const body = container.querySelector('[data-testid="body"]')!;
    expect(body.firstElementChild?.textContent).toBe("editDialog.saveFailed");
    expect(body.querySelector('[role="alert"]')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("실패가 아니면 없다", () => {
    act(() => root.render(<FormStep f={f} onSubmit={() => {}} />));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
