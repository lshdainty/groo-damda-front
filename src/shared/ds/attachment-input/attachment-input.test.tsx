// Attachment Input 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(안쪽 그림자 · 누르는 자리 44 · 구멍 · 축소 · 반응형 · 끄는 중 · 읽는 말)은 여기서 클래스와 속성으로 본다
// (attachment-input.measure.mjs 머리).
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Field } from "@/shared/ds/field";

import {
  AttachmentInput,
  type AttachmentEntry,
  type AttachmentInputProps,
  type AttachmentRejection,
} from "./attachment-input";
import { formatFileSize } from "./attachment-input-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const MB = 1024 * 1024;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom 에는 배치가 없어 어느 요소도 "보이지" 않는다 — 초점을 옮길 자리를 고르는 보임 검사가 통하게 한다
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => {};
});

afterAll(() => {
  vi.restoreAllMocks();
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

// 시트의 내려가는 모션을 jsdom 은 끝내지 않는다 — 끝났다고 알린다(고른 줄의 동작은 시트가 다 닫힌 뒤 불린다)
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
const choosing = async (el: HTMLElement) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await settle();
  // 모션이 끝나지 않으면 시트가 1초 뒤에 고른 줄의 동작을 부른다(use-pending-select)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1050));
  });
};

function render(node: ReactNode) {
  act(() => root.render(node));
}

const slot = (name: string) =>
  container.querySelector<HTMLElement>(`[data-slot=attachment-input-${name}]`);
const slots = (name: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `[data-slot=attachment-input-${name}]`,
    ),
  );
const trigger = () => slot("trigger") as HTMLButtonElement;
const group = () =>
  container.querySelector<HTMLElement>("[data-slot=attachment-input]")!;
const removes = () => slots("remove") as HTMLButtonElement[];
const picker = () => slot("picker") as HTMLInputElement;
const status = () => slot("status")!.textContent;

let seq = 0;
const entry = (over: Partial<AttachmentEntry> = {}): AttachmentEntry => {
  seq += 1;
  return {
    id: `e${seq}`,
    name: `사진_${seq}.jpg`,
    size: 2 * MB,
    type: "image/jpeg",
    status: "success",
    ...over,
  };
};
const pdf = (over: Partial<AttachmentEntry> = {}) =>
  entry({ name: `명세서_${seq + 1}.pdf`, type: "application/pdf", ...over });

const file = (name: string, size: number, type: string) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

const baseProps = {
  entries: [] as AttachmentEntry[],
  onFilesAccept: () => {},
  onRemove: () => {},
};
const setup = (props: Partial<AttachmentInputProps> = {}) =>
  render(<AttachmentInput aria-label="영수증" {...baseProps} {...props} />);

// 고르기 창에서 파일을 골랐다 — 숨은 입력의 change
const choose = (files: File[]) => {
  Object.defineProperty(picker(), "files", {
    configurable: true,
    value: files,
  });
  act(() => {
    picker().dispatchEvent(new Event("change", { bubbles: true }));
  });
};

// 드롭존에 끌어 놓기 — jsdom 에는 DataTransfer 가 없어 필요한 만큼만 흉내 낸다
const dragEvent = (type: string, files: File[]) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", {
    value: { types: ["Files"], files, dropEffect: "none" },
  });
  return e;
};

describe("formatFileSize", () => {
  it("B · KB · MB(소수 한 자리) · GB, 띄어 쓰지 않는다", () => {
    expect(formatFileSize(0)).toBe("0B");
    expect(formatFileSize(512)).toBe("512B");
    expect(formatFileSize(84 * 1024)).toBe("84KB");
    expect(formatFileSize(9.8 * MB)).toBe("9.8MB");
    expect(formatFileSize(1024 * MB)).toBe("1.0GB");
  });
});

describe("첨부 타일", () => {
  it('이름은 "{칸 이름} 첨부, n/최대", 개수는 지금 + /최대', () => {
    setup({ entries: [entry(), entry(), entry()], maxFiles: 10 });
    expect(group().getAttribute("role")).toBe("group");
    expect(trigger().getAttribute("aria-label")).toBe("파일 첨부, 3/10");
    expect(slot("count")!.textContent).toBe("3/10");
    expect(trigger().hasAttribute("aria-disabled")).toBe(false);
  });

  it("Field 안이면 라벨이 칸 이름이 된다", () => {
    render(
      <Field label="영수증">
        <AttachmentInput {...baseProps} entries={[entry()]} maxFiles={10} />
      </Field>,
    );
    const names = trigger().getAttribute("aria-labelledby")!.split(" ");
    const text = names
      .map((id) => container.querySelector(`[id="${id}"]`)?.textContent)
      .join("");
    expect(text).toContain("영수증");
    expect(text).toContain("첨부, 1/10");
  });

  it("triggerLabel 이 칸 이름보다 앞선다", () => {
    setup({ triggerLabel: "메모", maxFiles: 5 });
    expect(trigger().getAttribute("aria-label")).toBe("메모 첨부, 0/5");
  });

  it("다 차면 aria-disabled 로 막히고 초점은 남는다 — 눌러도 고르기 창이 열리지 않는다", () => {
    setup({ entries: [entry(), entry()], maxFiles: 2 });
    expect(trigger().getAttribute("aria-disabled")).toBe("true");
    expect(trigger().disabled).toBe(false);
    const open = vi.spyOn(picker(), "click");
    trigger().focus();
    act(() => trigger().click());
    expect(open).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it("누르면 고르기 창 — 최대가 2 이상이면 여럿을 고를 수 있다", () => {
    setup({ maxFiles: 5, accept: "image/*" });
    const open = vi.spyOn(picker(), "click");
    act(() => trigger().click());
    expect(open).toHaveBeenCalledTimes(1);
    expect(picker().multiple).toBe(true);
    expect(picker().accept).toBe("image/*");
    setup({ maxFiles: 1 });
    expect(picker().multiple).toBe(false);
  });

  it("최대가 없으면 개수를 그리지 않는다", () => {
    setup({ maxFiles: Infinity, entries: [entry()] });
    expect(slot("count")).toBeNull();
    expect(trigger().getAttribute("aria-label")).toBe("파일 첨부");
  });

  it("사진을 받으면 image, 파일만 받으면 paperclip 아이콘", () => {
    setup({ accept: "image/*" });
    const imageIcon = trigger().querySelector("svg")!.getAttribute("class");
    setup({ accept: ".csv" });
    const clipIcon = trigger().querySelector("svg")!.getAttribute("class");
    expect(imageIcon).toContain("lucide-image");
    expect(clipIcon).toContain("lucide-paperclip");
  });

  it("막힘 · 읽기 전용", () => {
    setup({ disabled: true, name: "f" });
    expect(trigger().disabled).toBe(true);
    expect(slot("value")!.hasAttribute("disabled")).toBe(true);
    expect(picker().disabled).toBe(true);
    setup({ readOnly: true, name: "f" });
    expect(trigger().getAttribute("aria-disabled")).toBe("true");
    expect(slot("value")!.hasAttribute("disabled")).toBe(false);
  });

  it("누름 축소 · 안쪽 포커스 링 · 막힌 모습의 클래스", () => {
    setup();
    const c = trigger().className;
    expect(c).toContain("size-[80px]");
    expect(c).toContain("rounded-r3");
    expect(c).toContain("active:[scale:calc(1-2/var(--press-basis))]");
    expect(c).toContain("motion-reduce:active:[scale:1]");
    expect(c).toContain("focus-visible:-outline-offset-2");
    expect(c).toContain("aria-disabled:active:[scale:1]");
    expect(c).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
  });
});

describe("고르기 · 거절", () => {
  const rejections = () => {
    const accepted: AttachmentEntry[][] = [];
    const rejected: AttachmentRejection[][] = [];
    const order: string[] = [];
    return {
      accepted,
      rejected,
      order,
      onFilesAccept: (a: AttachmentEntry[]) => {
        accepted.push(a);
        order.push("accept");
      },
      onFilesReject: (r: AttachmentRejection[]) => {
        rejected.push(r);
        order.push("reject");
      },
    };
  };

  it("통과한 파일은 pending 항목으로, 사진은 미리보기 주소를 단다", () => {
    const r = rejections();
    setup({ ...r, maxFiles: 10, accept: "image/*,application/pdf" });
    choose([
      file("a.jpg", MB, "image/jpeg"),
      file("b.pdf", MB, "application/pdf"),
    ]);
    const added = r.accepted[0]!;
    expect(added.map((e) => e.status)).toEqual(["pending", "pending"]);
    expect(added[0]!.previewUrl).toBe("blob:preview");
    expect(added[1]!.previewUrl).toBeUndefined();
    expect(added[0]!.file?.name).toBe("a.jpg");
    expect(r.rejected).toHaveLength(0);
  });

  it("형식이 다른 파일은 INVALID_TYPE — 'accept 만 믿지 않고' 다시 검사한다", () => {
    const r = rejections();
    setup({ ...r, maxFiles: 10, accept: "image/*,application/pdf" });
    choose([file("a.exe", MB, "application/x-msdownload")]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]![0]!.codes).toEqual(["INVALID_TYPE"]);
  });

  it("확장자로 받는 형식(.csv)도 다시 검사한다", () => {
    const r = rejections();
    setup({ ...r, accept: ".csv,.xlsx,.xls" });
    choose([file("a.txt", 10, "text/plain")]);
    expect(r.rejected[0]![0]!.codes).toEqual(["INVALID_TYPE"]);
    choose([file("A.CSV", 10, "text/csv")]);
    expect(r.accepted).toHaveLength(1);
  });

  it("5MB 를 넘는 파일은 FILE_TOO_LARGE", () => {
    const r = rejections();
    setup({ ...r, maxFiles: 10, maxFileSize: 5 * MB });
    choose([
      file("big.jpg", 5 * MB + 1, "image/jpeg"),
      file("ok.jpg", 5 * MB, "image/jpeg"),
    ]);
    expect(r.rejected[0]!.map((x) => x.file.name)).toEqual(["big.jpg"]);
    expect(r.rejected[0]![0]!.codes).toEqual(["FILE_TOO_LARGE"]);
    expect(r.accepted[0]!.map((e) => e.name)).toEqual(["ok.jpg"]);
  });

  it("형식도 크기도 틀리면 이유를 모두 담는다", () => {
    const r = rejections();
    setup({ ...r, accept: "image/*", maxFileSize: MB });
    choose([file("a.pdf", 2 * MB, "application/pdf")]);
    expect(r.rejected[0]![0]!.codes).toEqual([
      "INVALID_TYPE",
      "FILE_TOO_LARGE",
    ]);
  });

  it("남은 자리만큼은 앞에서부터 붙이고 나머지만 TOO_MANY_FILES — 파일 20개", () => {
    const r = rejections();
    const existing = Array.from({ length: 15 }, () => entry());
    setup({ ...r, entries: existing, maxFiles: 20 });
    choose(
      Array.from({ length: 20 }, (_, i) => file(`p${i}.jpg`, MB, "image/jpeg")),
    );
    expect(r.accepted[0]).toHaveLength(5);
    expect(r.accepted[0]!.map((e) => e.name)).toEqual([
      "p0.jpg",
      "p1.jpg",
      "p2.jpg",
      "p3.jpg",
      "p4.jpg",
    ]);
    expect(r.rejected[0]).toHaveLength(15);
    expect(
      r.rejected[0]!.every((x) => x.codes.join() === "TOO_MANY_FILES"),
    ).toBe(true);
  });

  it("통과 · 거절이 섞이면 onFilesAccept 를 먼저, onFilesReject 를 뒤에 부른다", () => {
    const r = rejections();
    setup({ ...r, accept: "image/*", maxFiles: 10 });
    choose([
      file("a.pdf", MB, "application/pdf"),
      file("b.jpg", MB, "image/jpeg"),
    ]);
    expect(r.order).toEqual(["accept", "reject"]);
  });

  it("막히면(다 참 · 읽기 전용 · 막힘) 고른 파일을 받지 않는다", () => {
    const r = rejections();
    setup({ ...r, entries: [entry()], maxFiles: 1 });
    choose([file("a.jpg", MB, "image/jpeg")]);
    expect(r.order).toHaveLength(0);
  });
});

describe("항목", () => {
  it("사진은 썸네일(80), 파일은 카드(160 × 80)로 한 줄에 섞인다 — 모양은 파일 종류가 정한다", () => {
    setup({
      entries: [
        entry({ previewUrl: "data:image/png;base64,x" }),
        pdf(),
        entry({ name: "표.xlsx", type: "" }),
      ],
      maxFiles: 10,
    });
    const items = slots("item");
    expect(items.map((i) => i.dataset.kind)).toEqual(["image", "file", "file"]);
    expect(items[0]!.className).toContain("w-[80px]");
    expect(items[1]!.className).toContain("w-[160px]");
    expect(items[1]!.className).toContain("h-[80px]");
    expect(slot("image")!.getAttribute("alt")).toBe("");
    // 확장자로 가른 파일 아이콘
    const icons = slots("thumbnail").map((t) =>
      t.querySelector("svg")!.getAttribute("class"),
    );
    expect(icons[0]).toContain("lucide-file-text");
    expect(icons[1]).toContain("lucide-file-spreadsheet");
  });

  it("MIME 이 없는 사진은 확장자로 가른다", () => {
    setup({ entries: [entry({ name: "a.HEIC", type: "" })] });
    expect(slot("item")!.dataset.kind).toBe("image");
  });

  it("항목 이름은 줄이지 않은 전체 파일 이름 + 크기 + 상태", () => {
    const longName =
      "2026년_10월_카드명세서_최종_수정본_v3_진짜최종_거래내역_전체.xlsx";
    setup({
      entries: [
        entry({
          name: longName,
          size: 4.2 * MB,
          type: "application/vnd.ms-excel",
        }),
        entry({ name: "a.jpg", status: "uploading", progress: 0.4, size: 512 }),
        entry({ name: "b.jpg", status: "error", size: 84 * 1024 }),
      ],
      maxFiles: 10,
      badgeLabel: "대표",
    });
    const texts = slots("item").map(
      (i) => i.textContent + (i.getAttribute("aria-label") ?? ""),
    );
    expect(texts[0]).toContain(`${longName}, 4.2MB`);
    expect(texts[1]).toContain("a.jpg, 512B, 대표, 올리는 중 40%");
    expect(texts[2]).toContain("b.jpg, 84KB, 올리지 못했어요");
  });

  it("올리는 중 글 — 99.6% 는 99%, 끝나기 전엔 100% 를 보이지 않는다", () => {
    setup({ entries: [entry({ status: "uploading", progress: 0.996 })] });
    const item = slots("item")[0]!;
    const text = item.textContent + (item.getAttribute("aria-label") ?? "");
    expect(text).toContain("올리는 중 99%");
    expect(text).not.toContain("100%");
  });

  it("파일 이름은 글자 단위 줄바꿈(break-all), 첫 줄만 오른쪽 4 를 비운다", () => {
    setup({ entries: [pdf()] });
    expect(slot("name")!.className).toContain("break-all");
    expect(slot("name-clear")!.className).toContain("float-right");
    expect(slot("name-clear")!.className).toContain("w-x1");
    // 줄 수를 재는 보이지 않는 같은 글은 보조 기술에서 숨긴다
    slot("name")!
      .querySelectorAll(":scope > .invisible")
      .forEach((m) => expect(m.getAttribute("aria-hidden")).toBe("true"));
  });

  it("대표 띠는 첫 사진에만(파일이 앞에 있어도), 쓰는 자리만", () => {
    setup({ entries: [pdf(), entry(), entry()], badgeLabel: "대표" });
    const badges = slots("badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]!.textContent).toBe("대표");
    expect(badges[0]!.closest("li")!.dataset.id).not.toBe(
      slots("item-root")[0]!.dataset.id,
    );
    setup({ entries: [entry()] });
    expect(slots("badge")).toHaveLength(0);
  });

  it("올리는 중 — 사진은 딤 + 값 있는 원, 파일 카드는 썸네일 칸의 원(아이콘 대신)", () => {
    setup({
      entries: [
        entry({ status: "uploading", progress: 0.4 }),
        pdf({ status: "uploading", progress: 0.75 }),
      ],
      maxFiles: 10,
    });
    expect(slot("backdrop")!.className).toContain("--overlay-dim-light");
    expect(slot("backdrop")!.className).toContain(
      "dark:bg-[var(--overlay-dim-dark)]",
    );
    const circles = container.querySelectorAll("[data-slot=progress-circle]");
    expect(circles).toHaveLength(2);
    expect(
      slots("thumbnail")[0]!.querySelector("svg:not([data-slot])"),
    ).toBeNull();
  });

  it("실패 — 덮개 65% 위 다시 시도, 파일 카드는 썸네일 · 이름 자리를 다시 시도가 채운다", () => {
    const onRetry = vi.fn();
    setup({
      entries: [
        entry({ status: "error", name: "a.jpg" }),
        pdf({ status: "error", name: "b.pdf" }),
      ],
      maxFiles: 10,
      onRetry,
    });
    expect(slot("backdrop")!.className).toContain(
      "bg-[var(--overlay-dim-dark)]",
    );
    expect(slot("backdrop")!.className).not.toContain("dark:");
    const retries = slots("retry");
    expect(retries.map((r) => r.getAttribute("aria-label"))).toEqual([
      "a.jpg 다시 시도",
      "b.pdf 다시 시도",
    ]);
    expect(retries[0]!.textContent).toBe("다시 시도");
    expect(retries[0]!.className).toContain("text-static-white");
    expect(retries[1]!.className).toContain("text-fg-neutral-subtle");
    // 파일 카드는 썸네일 · 이름 묶음을 숨긴다
    expect(slots("item-root")[1]!.className).toContain("group/attachment-item");
    expect(slots("thumbnail")[0]!.className).toContain(
      "group-data-[status=error]/attachment-item:hidden",
    );
    expect(slots("meta")[0]!.className).toContain(
      "group-data-[status=error]/attachment-item:hidden",
    );
    act(() => retries[1]!.click());
    expect(onRetry).toHaveBeenCalledWith(slots("item-root")[1]!.dataset.id);
  });

  it("진행이 10초 동안 멈춘 올리기는 실패로 보인다 — 쓰는 쪽의 상태는 그대로", () => {
    vi.useFakeTimers();
    const e = entry({ status: "uploading", progress: 0.4, name: "느림.jpg" });
    setup({ entries: [e], maxFiles: 10 });
    expect(slots("retry")).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(10_001);
    });
    expect(slots("retry")).toHaveLength(1);
    expect(slot("item-root")!.dataset.status).toBe("error");
    // 진행이 움직이면 다시 올리는 중
    setup({ entries: [{ ...e, progress: 0.5 }], maxFiles: 10 });
    expect(slots("retry")).toHaveLength(0);
  });

  it("막힘이면 다시 시도도 막힌다", () => {
    setup({
      entries: [entry({ status: "error" })],
      disabled: true,
      onRetry: () => {},
    });
    expect((slot("retry") as HTMLButtonElement).disabled).toBe(true);
  });

  it("읽는 말 — 붙음 · 올림 · 실패를 한 번씩, 실패는 칸의 설명에도", () => {
    const a = entry({ status: "pending" });
    setup({ entries: [], maxFiles: 10 });
    setup({ entries: [a], maxFiles: 10 });
    expect(status()).toContain("사진 1장을 붙였어요.");
    setup({ entries: [{ ...a, status: "success" }], maxFiles: 10 });
    expect(status()).toContain("1개를 올렸어요.");
    setup({ entries: [{ ...a, status: "error" }], maxFiles: 10 });
    expect(status()).toContain("1개는 올리지 못했어요.");
    const described = group().getAttribute("aria-describedby")!;
    expect(container.querySelector(`[id="${described}"]`)!.textContent).toBe(
      "1개는 올리지 못했어요.",
    );
    setup({ entries: [{ ...a, status: "error" }, pdf()], maxFiles: 10 });
    expect(status()).toContain("파일 1개를 붙였어요.");
  });
});

describe("× 지우기", () => {
  it('이름은 "{파일 이름} 지우기", 묻지 않고 지운다, 항목의 형제다(단추 안 단추 없음)', () => {
    const onRemove = vi.fn();
    const a = entry({ name: "a.jpg" });
    setup({ entries: [a], onRemove, onPreview: () => {} });
    const x = removes()[0]!;
    expect(x.getAttribute("aria-label")).toBe("a.jpg 지우기");
    expect(slot("item")!.contains(x)).toBe(false);
    expect(slot("item")!.querySelector("button")).toBeNull();
    act(() => x.click());
    expect(onRemove).toHaveBeenCalledWith(a.id);
  });

  it("누르는 자리 44(보이는 20 둘레 12) · 항목 모서리 밖으로 위 4 · 오른쪽 4 · 둘레 구멍 24", () => {
    setup({ entries: [entry()] });
    const c = removes()[0]!.className;
    expect(c).toContain("size-[20px]");
    expect(c).toContain("rounded-full");
    expect(c).toContain("-right-x1");
    expect(c).toContain("-top-x1");
    expect(c).toContain("before:-inset-x3");
    expect(c).toContain("group-data-[dragging]/attachment-item:hidden");
    expect(slot("item")!.className).toContain(
      "radial-gradient(circle_at_calc(100%_-_6px)_6px,transparent_12px",
    );
  });

  it("지운 뒤 초점 — 다음 항목의 × → 없으면 앞 항목의 × → 없으면 첨부 타일", () => {
    const a = entry({ name: "a.jpg" });
    const b = entry({ name: "b.jpg" });
    const c = entry({ name: "c.jpg" });
    const Harness = () => {
      const [list, setList] = useState([a, b, c]);
      return (
        <AttachmentInput
          {...baseProps}
          aria-label="영수증"
          entries={list}
          maxFiles={10}
          onRemove={(id) => setList((l) => l.filter((e) => e.id !== id))}
        />
      );
    };
    render(<Harness />);
    removes()[1]!.focus();
    act(() => removes()[1]!.click());
    expect(document.activeElement).toBe(removes()[1]);
    expect(removes()[1]!.getAttribute("aria-label")).toBe("c.jpg 지우기");
    act(() => removes()[1]!.click());
    expect(document.activeElement).toBe(removes()[0]);
    act(() => removes()[0]!.click());
    expect(document.activeElement).toBe(trigger());
  });

  it("읽기 전용 · 막힘이면 지우지 못한다", () => {
    const onRemove = vi.fn();
    setup({ entries: [entry()], onRemove, readOnly: true });
    expect(removes()[0]!.getAttribute("aria-disabled")).toBe("true");
    act(() => removes()[0]!.click());
    expect(onRemove).not.toHaveBeenCalled();
    setup({ entries: [entry()], onRemove, disabled: true });
    expect(removes()[0]!.disabled).toBe(true);
    act(() => removes()[0]!.click());
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("읽기 전용 — 사진은 불투명도 0.5, 파일 카드는 글 · 아이콘 fg-disabled(13B), 누르면 바로 크게 보기", () => {
    const onPreview = vi.fn();
    const a = entry();
    setup({ entries: [a, pdf()], readOnly: true, onPreview });
    expect(slots("item")[0]!.className).toContain(
      "group-data-[readonly]/attachment-item:opacity-50",
    );
    expect(slot("name")!.className).toContain(
      "group-data-[readonly]/attachment-item:text-fg-disabled",
    );
    expect(slot("size")!.className).toContain(
      "group-data-[readonly]/attachment-item:text-fg-disabled",
    );
    expect(slots("thumbnail")[0]!.className).toContain(
      "group-data-[readonly]/attachment-item:text-fg-disabled",
    );
    act(() => slots("item")[0]!.click());
    expect(onPreview).toHaveBeenCalledWith(a.id);
    expect(slots("item")[0]!.getAttribute("role")).toBe("button");
  });
});

describe("항목 메뉴 · 순서 바꾸기", () => {
  const menuText = () => document.body.textContent ?? "";
  const items3 = () => [
    entry({ name: "a.jpg" }),
    entry({ name: "b.jpg" }),
    entry({ name: "c.jpg" }),
  ];

  it("onReorder · onPreview 가 없으면 항목은 누를 수 없다(보이기만)", () => {
    setup({ entries: items3() });
    expect(slots("item")[0]!.hasAttribute("role")).toBe(false);
  });

  it("누를 수 있으면 role=button + 전체 이름 + 순서 바꾸기 설명", () => {
    setup({ entries: items3(), onReorder: () => {}, maxFiles: 10 });
    const item = slots("item")[1]!;
    expect(item.getAttribute("role")).toBe("button");
    expect(item.getAttribute("aria-label")).toBe("b.jpg, 2.0MB");
    expect(item.getAttribute("aria-roledescription")).toBe(
      "순서를 바꿀 수 있는 항목",
    );
    expect(item.getAttribute("aria-describedby")).toBeTruthy();
    expect(item.tabIndex).toBe(0);
  });

  it("누르면 메뉴 — 크게 보기 · 대표로 정하기 · 앞으로 · 뒤로 | 지우기, 맨 앞은 앞으로 · 대표로가 막힌다", async () => {
    const onReorder = vi.fn();
    const onPreview = vi.fn();
    const list = items3();
    setup({
      entries: list,
      onReorder,
      onPreview,
      badgeLabel: "대표",
      maxFiles: 10,
    });
    act(() => slots("item")[0]!.click());
    const text = menuText();
    for (const label of [
      "크게 보기",
      "대표로 정하기",
      "앞으로 옮기기",
      "뒤로 옮기기",
      "지우기",
    ]) {
      expect(text).toContain(label);
    }
    const rows = Array.from(
      document.body.querySelectorAll<HTMLElement>("button, [role=menuitem]"),
    );
    const row = (label: string) =>
      rows.find((r) => r.textContent?.includes(label))!;
    expect(
      row("앞으로 옮기기").hasAttribute("disabled") ||
        row("앞으로 옮기기").getAttribute("aria-disabled") === "true" ||
        row("앞으로 옮기기").hasAttribute("data-disabled"),
    ).toBe(true);
    await choosing(row("뒤로 옮기기"));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(
      onReorder.mock.calls[0]![0].map((e: AttachmentEntry) => e.name),
    ).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
  });

  it("맨 끝 항목은 뒤로 옮기기만 막힌다, 대표로 정하기는 맨 앞으로 보낸다", async () => {
    const onReorder = vi.fn();
    setup({ entries: items3(), onReorder, badgeLabel: "대표", maxFiles: 10 });
    act(() => slots("item")[2]!.click());
    const rows = Array.from(
      document.body.querySelectorAll<HTMLElement>("button, [role=menuitem]"),
    );
    const row = (label: string) =>
      rows.find((r) => r.textContent?.includes(label))!;
    const blocked = (el: HTMLElement) =>
      el.hasAttribute("disabled") ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("data-disabled");
    expect(blocked(row("뒤로 옮기기"))).toBe(true);
    expect(blocked(row("앞으로 옮기기"))).toBe(false);
    await choosing(row("대표로 정하기"));
    expect(
      onReorder.mock.calls[0]![0].map((e: AttachmentEntry) => e.name),
    ).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
  });

  it('파일 카드의 첫 줄은 "열기", 대표로 정하기는 없다', () => {
    setup({
      entries: [pdf(), pdf()],
      onReorder: () => {},
      onPreview: () => {},
      badgeLabel: "대표",
      maxFiles: 10,
    });
    act(() => slots("item")[0]!.click());
    expect(menuText()).toContain("열기");
    expect(menuText()).not.toContain("대표로 정하기");
  });

  it("지우기는 메뉴에서도 묻지 않고 onRemove", async () => {
    const onRemove = vi.fn();
    const list = items3();
    setup({ entries: list, onReorder: () => {}, onRemove, maxFiles: 10 });
    act(() => slots("item")[1]!.click());
    const rows = Array.from(
      document.body.querySelectorAll<HTMLElement>("button, [role=menuitem]"),
    );
    await choosing(rows.find((r) => r.textContent?.trim() === "지우기")!);
    expect(onRemove).toHaveBeenCalledWith(list[1]!.id);
  });

  it("키보드 — Space 로 들면 읽고, Esc 로 그만둘 수 있다", async () => {
    const onReorder = vi.fn();
    setup({ entries: items3(), onReorder, maxFiles: 10 });
    const item = slots("item")[0]!;
    item.focus();
    const key = (code: string, k = code) =>
      act(() => {
        item.dispatchEvent(
          new KeyboardEvent("keydown", {
            code,
            key: k,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    key("Space", " ");
    const live = Array.from(document.body.querySelectorAll("[aria-live]"))
      .map((n) => n.textContent)
      .join("|");
    expect(live).toContain("1번째 항목을 들었어요.");
    // dnd-kit 은 든 다음 틱에 키 처리기를 단다
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Escape",
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const after = Array.from(document.body.querySelectorAll("[aria-live]"))
      .map((n) => n.textContent)
      .join("|");
    expect(after).toContain("옮기기를 그만뒀어요. 처음 자리예요.");
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("읽기 전용 · 막힘이면 순서를 바꾸지 못한다(끌기 속성이 없다)", () => {
    setup({ entries: items3(), onReorder: () => {}, readOnly: true });
    expect(slots("item")[0]!.hasAttribute("aria-roledescription")).toBe(false);
    setup({ entries: items3(), onReorder: () => {}, disabled: true });
    expect(slots("item")[0]!.hasAttribute("aria-roledescription")).toBe(false);
  });
});

describe("드롭존", () => {
  const zone = () => slot("dropzone")!;

  it("1280 이상만 드롭존 — 안내 글 + 파일 선택 버튼(small), 미만은 버튼(large · 칸 폭 · 업로드 아이콘)", () => {
    setup({ layout: "dropzone", accept: ".csv" });
    expect(zone().className).toContain("hidden");
    expect(zone().className).toContain("lg:flex");
    expect(zone().className).toContain("h-[120px]");
    expect(zone().textContent).toContain("파일을 여기로 끌어다 놓으세요");
    const picks = slots("pick") as HTMLButtonElement[];
    expect(picks).toHaveLength(2);
    expect(zone().contains(picks[0]!)).toBe(true);
    expect(picks[0]!.textContent).toBe("파일 선택");
    const narrow = picks[1]!;
    expect(narrow.className).toContain("w-full");
    expect(narrow.className).toContain("lg:hidden");
    expect(narrow.querySelector("svg")!.getAttribute("class")).toContain(
      "lucide-upload",
    );
    // 상자 전체를 누르는 자리로 두지 않는다
    expect(zone().hasAttribute("onclick")).toBe(false);
    expect(zone().getAttribute("role")).toBeNull();
    expect(zone().tabIndex).toBe(-1);
  });

  it("타일 모양에서는 드롭존이 없다", () => {
    setup();
    expect(slot("dropzone")).toBeNull();
    expect(slots("pick")).toHaveLength(0);
  });

  it("파일 선택 버튼을 누르면 고르기 창", () => {
    setup({ layout: "dropzone" });
    const open = vi.spyOn(picker(), "click");
    act(() => (slots("pick")[0] as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("끌고 들어오면 dragOver, 나가면 풀린다 · 놓으면 고른 것과 같다", () => {
    const onFilesAccept = vi.fn();
    setup({ layout: "dropzone", accept: ".csv", onFilesAccept });
    const f = file("a.csv", 100, "text/csv");
    act(() => {
      zone().dispatchEvent(dragEvent("dragenter", [f]));
    });
    expect(zone().hasAttribute("data-drag-over")).toBe(true);
    act(() => {
      zone().dispatchEvent(dragEvent("dragleave", [f]));
    });
    expect(zone().hasAttribute("data-drag-over")).toBe(false);
    act(() => {
      zone().dispatchEvent(dragEvent("dragenter", [f]));
      zone().dispatchEvent(dragEvent("drop", [f]));
    });
    expect(zone().hasAttribute("data-drag-over")).toBe(false);
    expect(onFilesAccept).toHaveBeenCalledTimes(1);
    expect(onFilesAccept.mock.calls[0]![0][0].name).toBe("a.csv");
  });

  it("파일이 아닌 끌기는 받지 않는다", () => {
    setup({ layout: "dropzone" });
    const e = new Event("dragenter", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "dataTransfer", {
      value: { types: ["text/plain"] },
    });
    act(() => {
      zone().dispatchEvent(e);
    });
    expect(zone().hasAttribute("data-drag-over")).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it("다 차면 받지 않는다 — 끌어도 dragOver 가 없고 놓아도 붙지 않는다", () => {
    const onFilesAccept = vi.fn();
    setup({
      layout: "dropzone",
      entries: [entry()],
      maxFiles: 1,
      onFilesAccept,
    });
    const f = file("a.csv", 100, "text/csv");
    act(() => {
      zone().dispatchEvent(dragEvent("dragenter", [f]));
      zone().dispatchEvent(dragEvent("drop", [f]));
    });
    expect(zone().hasAttribute("data-drag-over")).toBe(false);
    expect(zone().hasAttribute("data-disabled")).toBe(true);
    expect(onFilesAccept).not.toHaveBeenCalled();
    expect((slots("pick")[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("드롭존 밖에 놓은 파일을 브라우저가 열지 않게 막는다 — 드롭존이 있는 동안만", () => {
    setup({ layout: "dropzone" });
    const outside = dragEvent("drop", [file("a.csv", 1, "text/csv")]);
    act(() => {
      document.body.dispatchEvent(outside);
    });
    expect(outside.defaultPrevented).toBe(true);
    setup();
    const again = dragEvent("drop", [file("a.csv", 1, "text/csv")]);
    act(() => {
      document.body.dispatchEvent(again);
    });
    expect(again.defaultPrevented).toBe(false);
  });

  it("고른 파일은 드롭존 아래 파일 카드로 — 줄은 화면 끝까지 넓히지 않는다", () => {
    setup({
      layout: "dropzone",
      entries: [pdf({ status: "uploading", progress: 0.5 })],
      maxFiles: 1,
    });
    const row = slot("row")!;
    expect(row.className).not.toContain("-mx-global-gutter");
    expect(
      row.querySelectorAll("[data-slot=attachment-input-item]"),
    ).toHaveLength(1);
    expect(slot("trigger")).toBeNull();
  });

  it("막힘이면 안내 글도 막힘 색, 테두리는 옅다", () => {
    setup({ layout: "dropzone", disabled: true });
    expect(zone().className).toContain(
      "data-[disabled]:border-stroke-neutral-weak",
    );
    expect(slot("dropzone-label")!.className).toContain(
      "group-data-[disabled]/attachment-dropzone:text-fg-disabled",
    );
  });
});

describe("Field 안", () => {
  it("라벨 · 설명 · 오류를 잇고 Field 의 막힘 · 읽기 전용을 받는다", () => {
    render(
      <Field
        label="영수증"
        description="사진 · PDF 를 10MB 까지 올려요."
        invalid
        errorMessage="10MB 넘는 파일은 올릴 수 없어요."
      >
        <AttachmentInput {...baseProps} />
      </Field>,
    );
    const label = group().getAttribute("aria-labelledby")!;
    expect(container.querySelector(`[id="${label}"]`)!.textContent).toContain(
      "영수증",
    );
    const described = group().getAttribute("aria-describedby")!;
    expect(
      container.querySelector(`[id="${described.split(" ")[0]}"]`)!.textContent,
    ).toContain("10MB 넘는 파일은 올릴 수 없어요.");
    render(
      <Field label="영수증" disabled>
        <AttachmentInput {...baseProps} />
      </Field>,
    );
    expect(trigger().disabled).toBe(true);
    render(
      <Field label="영수증" readOnly>
        <AttachmentInput {...baseProps} entries={[entry()]} maxFiles={3} />
      </Field>,
    );
    expect(trigger().getAttribute("aria-disabled")).toBe("true");
  });
});

describe("모양 — 검사기가 못 재는 값", () => {
  it("항목 줄은 화면 가장자리까지 넓히고(−gutter) 위 16 을 더 둔다, 끝 흐림은 Scroll Fog row", () => {
    setup({ entries: [entry()] });
    const row = slot("row")!;
    expect(row.className).toContain("-mx-global-gutter");
    expect(row.className).toContain("pt-x4");
    expect(row.className).toContain("-mt-x4");
  });

  it("사진 윤곽은 stroke-neutral-overlay, 파일 카드는 stroke-neutral-weak(안쪽 1px)", () => {
    setup({ entries: [entry(), pdf()] });
    const [image, card] = slots("item");
    expect(image!.className).toContain("var(--color-stroke-neutral-overlay)");
    expect(card!.className).toContain("var(--color-stroke-neutral-weak)");
  });

  it("끄는 중 · 읽기 전용의 축소 · 구멍 없음 · 불투명도는 항목 자리의 data-dragging 이 건다", () => {
    setup({ entries: [entry()] });
    const c = slot("item")!.className;
    expect(c).toContain(
      "group-data-[dragging]/attachment-item:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(c).toContain(
      "motion-reduce:group-data-[dragging]/attachment-item:[scale:1]",
    );
    expect(c).toContain(
      "group-data-[dragging]/attachment-item:[mask-image:none]",
    );
    expect(c).toContain("group-data-[dragging]/attachment-item:opacity-50");
    expect(c).toContain(
      "group-data-[dragging]/attachment-item:cursor-grabbing",
    );
  });

  it("대표 띠 · 실패 덮개는 두 모드 모두 65%, 올리는 중 덮개는 라이트 50% · 다크 65%", () => {
    setup({
      entries: [
        entry(),
        entry({ status: "uploading", progress: 0.1 }),
        entry({ status: "error" }),
      ],
      badgeLabel: "대표",
      maxFiles: 10,
    });
    expect(slot("badge")!.className).toContain("bg-[var(--overlay-dim-dark)]");
    const backdrops = slots("backdrop");
    expect(backdrops[0]!.className).toContain("bg-[var(--overlay-dim-light)]");
    expect(backdrops[0]!.className).toContain(
      "dark:bg-[var(--overlay-dim-dark)]",
    );
    expect(backdrops[1]!.className).not.toContain("dark:");
  });

  it("넘치는 파일 이름도 항목 이름에는 줄이지 않은 전체가 있다 — 긴 이름 · 확장자 없는 이름", () => {
    const long = "가".repeat(120);
    setup({
      entries: [
        entry({ name: long, type: "application/pdf" }),
        entry({ name: "noext" + "x".repeat(80), type: "text/plain" }),
      ],
    });
    const texts = slots("item").map((i) => i.textContent);
    expect(texts[0]).toContain(long);
    expect(texts[1]).toContain("noext" + "x".repeat(80));
  });
});
