// 라벨 화면 (I-09 09-3 · 44 ~ 49) — 줄은 누르는 줄(키보드로 닿는다), 데스크톱에만 줄 끝 삭제, 꺾쇠 없음, 실패는 다시 시도.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  fail: undefined as unknown as (o: { message: string }) => void,
  deleteCalls: [] as number[],
  saveCalls: [] as { kind: "create" | "update"; id?: number; data: unknown }[],
  q: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: undefined as unknown as () => void,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  // 실패 길을 막지 않는다 — 호출 인자를 state 에 남긴다
  useConfirmFail: () => (o: { message: string }) => state.fail(o),
}));
vi.mock("@/features/event-label", () => {
  const idle = () => ({
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
  });
  return {
    useEventLabels: () => state.q,
    // 저장 요청을 남긴다 — 폼이 자기 뮤테이션을 부른다(silent: 실패는 폼 맨 위 Callout)
    useCreateEventLabel: () => ({
      ...idle(),
      mutateAsync: async (data: unknown) => {
        state.saveCalls.push({ kind: "create", data });
      },
    }),
    useUpdateEventLabel: () => ({
      ...idle(),
      mutateAsync: async (v: { id: number; data: unknown }) => {
        state.saveCalls.push({ kind: "update", id: v.id, data: v.data });
      },
    }),
    // 삭제는 늘 실패한다 — 확인창 뒤 실패 길(스낵바 + 다시 시도)을 본다
    useDeleteEventLabel: () => ({
      mutate: () => {},
      mutateAsync: async (id: number) => {
        state.deleteCalls.push(id);
        throw new Error("fail");
      },
      isPending: false,
    }),
  };
});

const { CalendarLabelsSection } = await import("./CalendarLabelsSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.fail = vi.fn();
  state.deleteCalls = [];
  state.saveCalls = [];
  state.q = {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const labels = [
  {
    rowId: 1,
    labelName: "가족 행사·경조사 모임",
    color: "#3b82f6",
    usageCount: 2,
  },
];

const flush = () => act(async () => {});

describe("라벨 화면", () => {
  it("줄은 버튼이고 줄 끝에는 아무것도 없다(폰 · 데스크톱 모두 — 삭제는 편집 대화상자 · 밀기)", () => {
    state.q.data = labels;
    for (const mobile of [true, false]) {
      act(() => root.render(<CalendarLabelsSection mobile={mobile} />));
      const row = container.querySelector("[data-slot=list-item] button");
      expect(row?.textContent).toContain("가족 행사·경조사 모임");
      expect(container.querySelectorAll("[data-slot=list-suffix]").length).toBe(
        0,
      );
    }
  });

  it("불러오기 실패는 빈 목록이 아니라 다시 시도를 보이고, 누르면 refetch 한다", () => {
    state.q.isError = true;
    act(() => root.render(<CalendarLabelsSection mobile />));
    expect(container.textContent).toContain("labelsSection.loadFailed");
    expect(container.textContent).not.toContain("noLabels");
    const retry = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "retry",
    );
    expect(retry, "다시 시도 단추").not.toBeUndefined();
    act(() => retry!.click());
    expect(state.q.refetch).toHaveBeenCalledTimes(1);
  });

  it("내용이 있는 채 다시 불러오기가 실패하면 목록을 지우지 않는다", () => {
    state.q.data = labels;
    state.q.isError = true;
    act(() => root.render(<CalendarLabelsSection mobile />));
    expect(container.textContent).toContain("가족 행사·경조사 모임");
    expect(container.textContent).not.toContain("labelsSection.loadFailed");
  });

  it("불러오는 동안 목록 제목에 수(0)를 말하지 않는다", () => {
    state.q.isLoading = true;
    act(() => root.render(<CalendarLabelsSection mobile />));
    expect(container.textContent).not.toContain("· 0");
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
  });

  it("수정 대화상자 바닥 왼쪽 [삭제] → 확인창 → 실패하면 useConfirmFail(한 문장)", async () => {
    state.q.data = labels;
    act(() => root.render(<CalendarLabelsSection mobile={false} />));
    const row = container.querySelector(
      "[data-slot=list-item] button",
    ) as HTMLButtonElement;
    act(() => row.click());
    const del = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "delete",
    );
    expect(del, "수정 대화상자의 [삭제]").not.toBeUndefined();
    act(() => del!.click());
    await flush();
    expect(document.body.textContent).toContain("labelsSection.deleteTitle");
    const confirm = [...document.body.querySelectorAll("button")]
      .filter((b) => b.textContent?.trim() === "delete")
      .pop();
    await act(async () => {
      confirm!.click();
    });
    await flush();
    expect(state.deleteCalls).toEqual([1]);
    expect(state.fail).toHaveBeenCalledWith(
      expect.objectContaining({ message: "labelsSection.deleteFailed" }),
    );
  });

  it("라벨 폼 — 이름 칸은 12자에서 멈추고 미리보기가 없고, 옛 13자 이름은 그대로 저장할 수 있다", async () => {
    state.q.data = [
      {
        rowId: 9,
        labelName: "열세 글자짜리 아주 긴 옛 라벨",
        color: "#3b82f6",
        usageCount: 0,
      },
    ];
    act(() => root.render(<CalendarLabelsSection mobile={false} />));
    act(() =>
      (
        container.querySelector(
          "[data-slot=list-item] button",
        ) as HTMLButtonElement
      ).click(),
    );
    const save = () =>
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "save",
      ) as HTMLButtonElement;
    // 미리보기 면은 없다(5-B) — 이름 칸 · "색상" 줄 · 글자 수만
    expect(document.body.textContent).not.toContain("preview");
    expect(document.body.textContent).toContain("form.color");
    // [저장] 은 늘 켜 둔다(field.md:86) — 이름을 안 건드렸으면 길이 때문에 막히지 않고 요청이 나간다
    expect(save().disabled).toBe(false);
    await act(async () => {
      save().click();
    });
    expect(state.saveCalls).toEqual([
      {
        kind: "update",
        id: 9,
        data: { labelName: "열세 글자짜리 아주 긴 옛 라벨", color: "#3b82f6" },
      },
    ]);
    // 옛 긴 이름은 고치기 시작해도 잘리지 않는다 — 한 글자만 지우면 그만큼만 줄고, 12 초과면 칸 오류로 [저장] 이 나가지 않는다
    const input = document.body.querySelector("input") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    const edited = "열세 글자짜리 아주 긴 옛 라벨".slice(0, -1);
    act(() => {
      setter?.call(input, edited);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe(edited);
    await act(async () => {
      save().click();
    });
    expect(state.saveCalls.length).toBe(1);
    expect(document.body.textContent).toContain("labelsSection.nameTooLong");
    // 세는 줄 분모는 규칙 값 12 — 옛 이름에 한 글자 더하면 "{n}/12" 가 오류 색
    act(() => {
      setter?.call(input, "열세 글자짜리 아주 긴 옛 라벨" + "!");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // 옛 17자에 한 글자 더해도 잘리지 않는다 — "18/12" 오류 색, [저장] 은 막힌다
    expect(input.value.length).toBe(18);
    const count = [...document.body.querySelectorAll("p")].find((p) =>
      /^\d+\/\d+$/.test(p.textContent ?? ""),
    ) as HTMLElement;
    expect(count.textContent).toBe("18/12");
    expect(count.querySelector(".text-fg-critical")).not.toBeNull();
    expect(state.saveCalls.length).toBe(1);
  });

  it("정상 12자 이하는 n/12 이고 오류 색이 아니다", () => {
    state.q.data = labels;
    act(() => root.render(<CalendarLabelsSection mobile={false} />));
    act(() =>
      (
        container.querySelector(
          "[data-slot=list-item] button",
        ) as HTMLButtonElement
      ).click(),
    );
    const count = [...document.body.querySelectorAll("p")].find((p) =>
      /^\d+\/\d+$/.test(p.textContent ?? ""),
    ) as HTMLElement;
    expect(count.textContent).toBe("12/12");
    expect(count.querySelector(".text-fg-critical")).toBeNull();
  });
});
