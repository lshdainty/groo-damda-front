// 초대 코드 Enter 연타 — **누른 만큼 참여 요청이 나갔다**(5번 → 5번, QA #134).
//
// 저장 버튼은 이미 막혀 있었다(`saving` 이면 비활성). 막힌 건 그 문 하나였고 Enter 는
// 다른 문으로 들어왔다. 같은 자리를 앞서 두 번 겪었다 — 할 일 빠른 추가(#122),
// 내역 추가 시트(QA #132). 그래서 규범이 이미 적혀 있다:
// **연타 가드는 입구가 아니라 나가는 함수가 든다**(`shared/lib/groo/enter-save.ts`).
//
// 여기서 잠그는 건 "Enter 를 한 번만 받는다" 가 아니라 **"몇 번을 눌러도 요청은 한 번"**
// 이다. 입구가 하나 더 늘어도(단축키·폼 제출) 같은 함수를 지나면 그대로 막힌다.
//
// 한 흐름을 `it` 하나에 담은 건 취향이 아니라 제약이다 — Radix 대화상자를 띄운 테스트
// 뒤에는 같은 파일의 다음 테스트에서 **버튼 클릭 이벤트가 전달되지 않는다**(jsdom).
// 그래서 대화상자는 파일당 한 번만 연다. 빈 코드 → 입력 → 연타가 실제 사용자의 순서이기도 하다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({ joinCalls: [] as string[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => () => {},
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: { rowId: 1 }, isLoading: false }),
}));
vi.mock("@/features/user-calendar", async () => {
  const { useState } = await import("react");
  const idleMut = () => ({ mutate: () => {}, isPending: false });
  return {
    useUserCalendars: () => ({ data: [], isLoading: false }),
    useCreateUserCalendar: idleMut,
    useDeleteUserCalendar: idleMut,
    useUpdateUserCalendar: idleMut,
    useCalendarMembers: () => ({ data: [], isLoading: false }),
    useChangeCalendarMemberRole: idleMut,
    useRegenerateCalendarInviteCode: idleMut,
    useRemoveCalendarMember: idleMut,
    // react-query 뮤테이션과 같은 모양 — 요청이 나가면 `isPending` 이 서고, 그 값이
    // 다시 그려져 다이얼로그의 `submitting` 으로 내려간다. 가드가 볼 값이 이것이다.
    useJoinCalendar: () => {
      const [pending, setPending] = useState(false);
      return {
        mutate: (code: string) => {
          state.joinCalls.push(code);
          setPending(true);
        },
        isPending: pending,
      };
    },
  };
});

const { CalendarShareSection } = await import("./CalendarShareSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.joinCalls = [];
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** 다이얼로그는 포털로 body 에 붙는다 — 컨테이너가 아니라 body 에서 찾는다. */
function openJoinDialog(): HTMLInputElement {
  act(() => root.render(<CalendarShareSection mobile={false} />));
  const opener = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "join",
  );
  expect(opener, "초대 코드 참여 버튼").not.toBeUndefined();
  act(() => opener!.click());
  const input = document.body.querySelector("input");
  expect(input, "초대 코드 입력칸").not.toBeNull();
  return input as HTMLInputElement;
}

/** React 는 값 변경을 자기 트래커로 본다 — 네이티브 setter 를 거쳐야 onChange 가 뜬다. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(input: HTMLInputElement, times: number) {
  for (let i = 0; i < times; i++) {
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
  }
}

describe("초대 코드 참여", () => {
  it("빈 코드로는 안 나가고, Enter 를 다섯 번 눌러도 요청은 한 번이다", () => {
    const input = openJoinDialog();

    // ① 아직 아무것도 안 쳤다 — 눌러도 나갈 게 없다.
    pressEnter(input, 3);
    expect(state.joinCalls, "빈 코드").toEqual([]);

    // ② 코드를 넣고 연타 — 서버로는 한 번만 간다(대문자로 정규화해서).
    type(input, "ab12cd");
    pressEnter(input, 5);
    expect(state.joinCalls, "Enter 5연타").toEqual(["AB12CD"]);
  });
});
