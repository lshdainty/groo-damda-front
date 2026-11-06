// 알림 줄 — SEED List 줄(9-1 A · 9-2 A). 팝오버 · 시트 · 알림 화면이 같은 줄을 쓴다.
// 알림 화면은 줄마다 × 를 달지 않는다(W4, 2026-10-21) — 줄 안에 따로 누르는 것이 없다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { List } from "@/shared/ds/list";

import type { Notification } from "../model/types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("../lib/relativeTime", () => ({ relativeTime: () => "방금" }));

const { NotificationRow } = await import("./NotificationRow");

const base: Notification = {
  rowId: 1,
  userRowId: 1,
  notificationType: "SYSTEM",
  title: "예산을 넘었어요",
  message: "식비 예산 120% 를 썼어요",
  referenceType: null,
  referenceId: null,
  isRead: false,
  readAt: null,
  createAt: "2026-10-21T00:00:00",
};

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

const render = (n: Notification, onClick?: () => void) =>
  act(() =>
    root.render(
      <List aria-label="알림">
        <NotificationRow notification={n} now={0} onClick={onClick} />
      </List>,
    ),
  );

describe("NotificationRow", () => {
  it("안 읽은 줄은 버튼 하나뿐 — 줄 안에 따로 누르는 × 가 없다", () => {
    const onClick = vi.fn();
    render(base, onClick);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("data-slot")).toBe("list-body");
    expect(container.querySelector("[aria-label='delete']")).toBeNull();
    act(() => buttons[0]!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("menu(⋮)를 넘기면 시각 옆 뒤 붙이개에 놓인다 — 읽음 버튼의 형제이고 버튼 안에 들어가지 않는다", () => {
    const render2 = (n: Notification) =>
      act(() =>
        root.render(
          <List aria-label="알림">
            <NotificationRow
              notification={n}
              now={0}
              onClick={vi.fn()}
              menu={<button type="button" data-slot="notification-more" />}
            />
          </List>,
        ),
      );
    for (const n of [base, { ...base, isRead: true }]) {
      render2(n);
      const more = container.querySelector("[data-slot=notification-more]")!;
      expect(more.closest("[data-slot=list-suffix]")).not.toBeNull();
      expect(more.closest("[data-slot=list-body]")).toBeNull();
      expect(
        container.querySelector("[data-slot=list-suffix]")!.textContent,
      ).toBe("방금");
    }
  });

  it("읽은 줄은 보기만 하는 줄 — 버튼이 하나도 없다", () => {
    render({ ...base, isRead: true }, vi.fn());
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelector("[data-slot=list-body]")!.tagName).toBe(
      "SPAN",
    );
  });

  it("뒤 붙이개는 시각 글 하나(13 · subtle) — 버튼 · 아이콘이 없다", () => {
    render(base, vi.fn());
    const suffix = container.querySelector("[data-slot=list-suffix]")!;
    expect(suffix.textContent).toBe("방금");
    expect(suffix.querySelector("button, svg")).toBeNull();
    expect(suffix.firstElementChild!.className).toContain("text-t3");
    expect(suffix.firstElementChild!.className).toContain(
      "text-fg-neutral-subtle",
    );
  });

  it("타일 40 · 제목 t5 400 · 안 읽은 줄은 옅은 브랜드 바탕(highlighted)", () => {
    render(base, vi.fn());
    expect(
      container.querySelector("[data-slot=list-tile]")!.className,
    ).toContain("size-x10");
    const title = container.querySelector("[data-slot=list-title]")!;
    expect(title.className).toContain("text-t5");
    expect(title.className).toContain("font-normal");
    expect(
      container.querySelector("[data-slot=list-background]")!.className,
    ).toContain("bg-bg-brand-weak");
  });
});

describe("읽음으로 바꾸는 중 (I-wrap-b1 ε 8)", () => {
  it("제목 끝에 ds Progress Circle 24 — 옛 Spinner 가 아니고, 기다리는 일을 이름으로 말한다", () => {
    act(() =>
      root.render(
        <List aria-label="알림">
          <NotificationRow notification={base} now={0} pending />
        </List>,
      ),
    );
    const circle = container.querySelector<HTMLElement>(
      "[data-slot=progress-circle]",
    );
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute("role")).toBe("progressbar");
    expect(circle!.getAttribute("aria-label")).toBe("row.marking");
    expect(circle!.style.width).toBe("var(--pc-size)");
    expect(circle!.getAttribute("class")).toContain("[--pc-size:24px]");
    expect(container.querySelector("[role=status]")).toBeNull();
  });
});
