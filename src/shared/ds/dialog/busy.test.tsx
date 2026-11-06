// 저장하는 동안은 닫지 않는다(I-wrap-b2b 단계 1) — ResponsiveDialog 의 busy. 대화상자(1280 이상) · 시트(미만) 둘 다.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "./dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = false;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
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
  await new Promise((r) => setTimeout(r, 50));
});

const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const surface = () =>
  q("[data-slot=dialog-content]") ?? q("[data-slot=bottom-sheet-content]");
const body = () =>
  q("[data-slot=dialog-body]") ?? q("[data-slot=bottom-sheet-body]");
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === text,
  );
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });
const back = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

/** 저장 폼 — 저장을 누르면 save() 의 약속이 끝날 때까지 busy, 실패면 맨 위 Callout 자리에 글을 남기고 값을 둔다 */
function SaveForm({
  save,
  onClose,
  dirtyFromStart = false,
  onBack,
  form = true,
}: {
  save: () => Promise<void>;
  onClose: () => void;
  dirtyFromStart?: boolean;
  onBack?: () => void;
  /** false 면 바깥(딤) 누르기로 닫히는 표면 — busy 가 그 길도 막는지 본다 */
  form?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [memo, setMemo] = useState(dirtyFromStart ? "점심" : "");
  const submit = () => {
    setBusy(true);
    setFailed(false);
    save().then(
      () => {
        setBusy(false);
        setOpen(false);
        onClose();
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
    );
  };
  return (
    <ResponsiveDialog
      form={form}
      open={open}
      dirty={memo !== ""}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent title="메모 수정" onBack={onBack}>
        <ResponsiveDialogBody>
          {failed && <div role="alert">저장하지 못했어요.</div>}
          <input
            aria-label="메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>취소</ResponsiveDialogCancel>
          <Button loading={busy} onClick={submit}>
            저장
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** 저장을 누르고 응답을 붙잡아 둔다 — reject() 로 실패를 낸다 */
async function startSaving(
  extra: Partial<Parameters<typeof SaveForm>[0]> = {},
) {
  let reject!: (e: unknown) => void;
  const save = () =>
    new Promise<void>((_, r) => {
      reject = r;
    });
  const onClose = vi.fn();
  act(() => root.render(<SaveForm save={save} onClose={onClose} {...extra} />));
  await tick();
  act(() => byText("저장")!.click());
  await tick();
  return { onClose, fail: () => reject(new Error("500")) };
}

for (const w of [false, true]) {
  const name = w ? "대화상자(1280 이상)" : "시트(1280 미만)";
  describe(`${name} — 저장 중에는 닫지 않는다`, () => {
    beforeEach(() => {
      wide = w;
    });

    it("Esc 를 눌러도 닫히지 않고, 실패하면 맨 위 실패 글과 친 값이 남는다", async () => {
      const { onClose, fail } = await startSaving({ dirtyFromStart: true });
      key(surface()!, "Escape");
      await tick();
      expect(onClose).not.toHaveBeenCalled();
      expect(surface()).not.toBeNull();
      // 묻지도 않는다 — "작성한 내용이 사라져요" 확인창이 뜨지 않는다
      expect(q("[role=alertdialog]")).toBeNull();
      await act(async () => fail());
      await tick();
      expect(q("[role=alert]")?.textContent).toBe("저장하지 못했어요.");
      expect((q("input[aria-label=메모]") as HTMLInputElement).value).toBe(
        "점심",
      );
    });

    // 폼은 원래 바깥 누르기를 무시한다 — 바깥 누르기로 닫히는 표면(form 아님)으로 보고, busy 없이는 닫히는 대조를 둔다(검수 L7)
    const pressDim = () =>
      act(() => {
        const dim =
          q("[data-slot=dialog-overlay]") ??
          q("[data-slot=bottom-sheet-overlay]");
        dim!.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
        );
      });
    it("바깥(딤)을 눌러 닫히는 표면도 저장 중에는 닫히지 않는다 — 저장 중이 아니면 닫힌다(대조)", async () => {
      const { onClose, fail } = await startSaving({ form: false });
      pressDim();
      await tick();
      expect(onClose).not.toHaveBeenCalled();
      expect(surface()).not.toBeNull();
      await act(async () => fail());
      await tick();
      pressDim();
      await tick();
      expect(onClose).toHaveBeenCalled();
    });

    it("입력칸에 초점을 둔 채 저장하면 초점이 표면으로 옮겨 가둠 안에 남고, 실패하면 그 칸으로 돌아온다(검수 M2)", async () => {
      let reject!: (e: unknown) => void;
      const save = () =>
        new Promise<void>((_, r) => {
          reject = r;
        });
      act(() => root.render(<SaveForm save={save} onClose={() => {}} />));
      await tick();
      const input = q("input[aria-label=메모]") as HTMLInputElement;
      act(() => input.focus());
      expect(document.activeElement).toBe(input);
      act(() => byText("저장")!.click());
      await tick();
      // 본문이 inert 가 되기 전에 표면으로 — 문서(body)로 빠지지 않는다
      expect(document.activeElement).toBe(surface());
      await act(async () => reject(new Error("500")));
      await tick();
      expect(document.activeElement).toBe(input);
    });

    it("머리 ← 를 눌러도 한 단계 뒤로 가지 않는다", async () => {
      const onBack = vi.fn();
      await startSaving({ onBack });
      act(() =>
        (q("[data-slot=dialog-back]") ??
          q("[data-slot=bottom-sheet-back]"))!.click(),
      );
      expect(onBack).not.toHaveBeenCalled();
    });

    it("본문은 입력을 받지 않고(inert), 저장이 끝나면 다시 받는다", async () => {
      const { fail } = await startSaving();
      expect(body()!.hasAttribute("inert")).toBe(true);
      expect(surface()!.getAttribute("aria-busy")).toBe("true");
      await act(async () => fail());
      await tick();
      expect(body()!.hasAttribute("inert")).toBe(false);
      expect(surface()!.hasAttribute("aria-busy")).toBe(false);
    });

    it("실패 뒤에는 다시 닫힌다(busy 는 저장하는 동안만)", async () => {
      const { onClose, fail } = await startSaving();
      await act(async () => fail());
      await tick();
      key(surface()!, "Escape");
      await tick();
      expect(onClose).toHaveBeenCalled();
    });
  });
}

describe("대화상자(1280 이상) — 바닥 [취소]", () => {
  beforeEach(() => {
    wide = true;
  });
  it("저장 중 [취소] 를 눌러도 닫히지 않는다", async () => {
    const { onClose } = await startSaving();
    act(() => byText("취소")!.click());
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(surface()).not.toBeNull();
  });
});

describe("시트(1280 미만) — 닫기 X · 뒤로 가기", () => {
  beforeEach(() => {
    wide = false;
  });

  it("닫기 X 는 모양 그대로(흐리게 하지 않음) 두고, 눌러도 닫히지 않는다", async () => {
    const { onClose } = await startSaving();
    const x = q("[data-slot=bottom-sheet-close]") as HTMLButtonElement;
    expect(x.disabled).toBe(false);
    expect(x.hasAttribute("aria-disabled")).toBe(false);
    act(() => x.click());
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(surface()).not.toBeNull();
  });

  it("뒤로 가기에도 닫히지 않고 칸을 다시 쌓는다 — 실패 뒤 뒤로 가기는 이 시트를 닫는다(페이지를 떠나지 않는다)", async () => {
    const { onClose, fail } = await startSaving();
    back();
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(surface()).not.toBeNull();
    await act(async () => fail());
    await tick();
    back();
    await tick();
    expect(onClose).toHaveBeenCalled();
  });
});
