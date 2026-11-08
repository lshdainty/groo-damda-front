// Avatar 의 동작 — 크기 · 색 · 테두리는 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Avatar, AvatarPhotoEdit, AvatarStack } from "./avatar";
import {
  avatarHue,
  avatarInitial,
  avatarStackVisible,
} from "./avatar-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const initial = (el: HTMLElement) =>
  el.querySelector<HTMLElement>("[data-slot=avatar-initial]");

const PEOPLE = ["김민수", "이서연", "박지훈", "최유진", "정하늘", "한지우"];

describe("avatarInitial", () => {
  it("표시 이름(앞뒤 공백을 뺀)의 첫 글자 하나 — 로마자는 대문자", () => {
    expect(avatarInitial("김민수")).toBe("김");
    expect(avatarInitial("Kim Minsu")).toBe("K");
    expect(avatarInitial("  kim  ")).toBe("K");
    expect(avatarInitial("1번 손님")).toBe("1");
  });

  it("대문자로 바꿔 글자가 늘면 원래 첫 글자 — 이니셜은 늘 한 글자, 앞뒤 공백은 앱 trim 과 같은 목록(03E-020)", () => {
    expect(avatarInitial("ßeta")).toBe("ß");
    expect(avatarInitial("ﬁsh")).toBe("ﬁ");
    expect(avatarInitial("\u0085김민수")).toBe("김");
    expect(avatarInitial("\u0085kim\u0085")).toBe("K");
    expect(avatarHue("\u0085김민수")).toBe(avatarHue("김민수"));
  });

  it("사용자가 보는 글자 단위로 자른다 — 가족 그림 글자는 한 글자다", () => {
    expect(avatarInitial("👨‍👩‍👧 우리집")).toBe("👨‍👩‍👧");
  });

  it("이름이 비면 글자가 없다", () => {
    expect(avatarInitial("")).toBe("");
    expect(avatarInitial("   ")).toBe("");
  });
});

describe("avatarHue", () => {
  it("코드 포인트 합 % 10 → 차트 10색(v110 순서) — 웹 · 앱이 같은 답", () => {
    expect(avatarHue("김민수")).toBe("blue"); // 142420 % 10 = 0
    expect(avatarHue("이서연")).toBe("brown"); // 151168 % 10 = 8
    expect(avatarHue("Kim Minsu")).toBe("indigo"); // 845 % 10 = 5
  });

  it("UTF-16 단위가 아니라 코드 포인트로 더하고, 앞뒤 공백은 뺀다", () => {
    // U+1F600 128512 → 2 orange (UTF-16 두 단위로 더하면 112189 → 9 gray)
    expect(avatarHue("😀")).toBe("orange");
    expect(avatarHue("  김민수 ")).toBe("blue");
  });

  it("이름이 비면 gray", () => {
    expect(avatarHue("")).toBe("gray");
  });
});

describe("Avatar", () => {
  it("사진이 없으면 이니셜 + 이름 색 — 기본 48, 옆에 이름이 있는 장식", () => {
    const avatar = render(<Avatar name="김민수" />);
    expect(avatar.dataset.slot).toBe("avatar");
    expect(avatar.dataset.status).toBe("none");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.hasAttribute("role")).toBe(false);
    expect(avatar.className).toContain("size-[48px]");
    const letter = initial(avatar)!;
    expect(letter.textContent).toBe("김");
    expect(letter.className).toContain("bg-chart-blue");
    expect(letter.className).toContain("text-[19px]");
    // 줄 높이 1 — 크기의 글자 뒤에 남는다
    expect(letter.className).toContain("leading-none");
    expect(avatar.querySelector("img")).toBeNull();
  });

  it("작은 크기도 글자는 10 아래로 내리지 않는다", () => {
    const avatar = render(<Avatar size={20} name="Kim Minsu" />);
    expect(avatar.className).toContain("size-[20px]");
    const letter = initial(avatar)!;
    expect(letter.className).toContain("text-[10px]");
    expect(letter.textContent).toBe("K");
    expect(letter.className).toContain("bg-chart-indigo");
  });

  it("혼자면 이름을 읽는다 — role=img + 앞뒤 공백을 뺀 이름", () => {
    const avatar = render(
      <Avatar name=" 김민수 " decorative={false} size={36} />,
    );
    expect(avatar.getAttribute("role")).toBe("img");
    expect(avatar.getAttribute("aria-label")).toBe("김민수");
    expect(avatar.hasAttribute("aria-hidden")).toBe(false);
    // 이니셜 글자는 따로 읽지 않는다("김 김민수" 가 아니다)
    expect(initial(avatar)!.getAttribute("aria-hidden")).toBe("true");
  });

  it("이름이 비면 회색 원에 글자를 넣지 않는다", () => {
    const avatar = render(<Avatar name="" />);
    const letter = initial(avatar)!;
    expect(letter.className).toContain("bg-chart-gray");
    expect(letter.textContent).toBe("");
  });

  it("사진 — 불러오는 동안 이니셜이 보이고, 다 불러오면 이니셜을 걷는다", () => {
    const avatar = render(<Avatar name="김민수" src="/photos/1.png" />);
    expect(avatar.dataset.status).toBe("loading");
    expect(initial(avatar)).not.toBeNull();
    const img = avatar.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    expect(img.dataset.slot).toBe("avatar-image");
    act(() => {
      img.dispatchEvent(new Event("load"));
    });
    expect(avatar.dataset.status).toBe("loaded");
    expect(initial(avatar)).toBeNull();
  });

  it("사진을 못 불러오면 이니셜 그대로 — 깨진 그림이 남지 않는다", () => {
    const avatar = render(<Avatar name="김민수" src="/photos/broken.png" />);
    act(() => {
      avatar.querySelector("img")!.dispatchEvent(new Event("error"));
    });
    expect(avatar.dataset.status).toBe("error");
    expect(avatar.querySelector("img")).toBeNull();
    expect(initial(avatar)!.textContent).toBe("김");
  });

  it("사진이 바뀌면 다시 불러온다 — 그동안 이니셜", () => {
    render(<Avatar name="김민수" src="/photos/1.png" />);
    act(() => {
      container.querySelector("img")!.dispatchEvent(new Event("load"));
    });
    const avatar = render(<Avatar name="김민수" src="/photos/2.png" />);
    expect(avatar.dataset.status).toBe("loading");
    expect(initial(avatar)).not.toBeNull();
    expect(avatar.querySelector("img")!.getAttribute("src")).toBe(
      "/photos/2.png",
    );
  });

  it("붙기 전에 이미 끝난 사진은 붙자마자 읽고, 다시 그려도 상태를 또 바꾸지 않는다", () => {
    const proto = HTMLImageElement.prototype;
    const complete = Object.getOwnPropertyDescriptor(proto, "complete")!;
    const naturalWidth = Object.getOwnPropertyDescriptor(
      proto,
      "naturalWidth",
    )!;
    Object.defineProperty(proto, "complete", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(proto, "naturalWidth", {
      configurable: true,
      get: () => 96,
    });
    try {
      const avatar = render(<Avatar name="김민수" src="/photos/1.png" />);
      expect(avatar.dataset.status).toBe("loaded");
      expect(initial(avatar)).toBeNull();
      // 다시 그려도 그대로 — 붙는 함수가 바뀌어 상태를 또 바꾸는 고리가 없다
      const again = render(
        <Avatar name="김민수" src="/photos/1.png" className="mt-x1" />,
      );
      expect(again.dataset.status).toBe("loaded");
    } finally {
      Object.defineProperty(proto, "complete", complete);
      Object.defineProperty(proto, "naturalWidth", naturalWidth);
    }
  });

  it("쓰는 쪽의 className · ref 를 받는다", () => {
    const ref = createRef<HTMLSpanElement>();
    const avatar = render(<Avatar ref={ref} name="김민수" className="mt-x1" />);
    expect(ref.current).toBe(avatar);
    expect(avatar.className).toContain("mt-x1");
  });
});

describe("Avatar — 올리는 중(uploading)", () => {
  const bar = (el: HTMLElement) =>
    el.querySelector<SVGElement>("[data-slot=progress-circle]");

  it("uploadProgress 가 없으면 덮개가 없다 — 평소 모양 그대로", () => {
    const avatar = render(<Avatar name="한지우" decorative={false} />);
    expect(avatar.querySelector("[data-slot=avatar-upload]")).toBeNull();
    expect(avatar.hasAttribute("data-uploading")).toBe(false);
    expect(avatar.getAttribute("role")).toBe("img");
  });

  it('원 위 딤(라이트 50% · 다크 65%, 원 모양) 가운데 값 있는 원 24 staticWhite — 이름 "프로필 사진 올리는 중" · 값 글 40%', () => {
    const avatar = render(
      <Avatar
        size={108}
        name="한지우"
        decorative={false}
        uploadProgress={0.4}
      />,
    );
    const overlay = avatar.querySelector<HTMLElement>(
      "[data-slot=avatar-upload]",
    )!;
    expect(overlay.className).toEqual(
      expect.stringContaining("bg-[var(--overlay-dim-light)]"),
    );
    expect(overlay.className).toContain("dark:bg-[var(--overlay-dim-dark)]");
    expect(overlay.className).toContain("rounded-full");
    expect(overlay.className).toContain("absolute inset-0");
    const circle = bar(avatar)!;
    expect(circle.getAttribute("data-size")).toBe("24");
    expect(circle.getAttribute("data-tone")).toBe("staticWhite");
    expect(circle.getAttribute("data-mode")).toBe("determinate");
    expect(circle.getAttribute("aria-label")).toBe("프로필 사진 올리는 중");
    expect(circle.getAttribute("aria-valuenow")).toBe("40");
    expect(circle.getAttribute("aria-valuetext")).toBe("40%");
    expect(avatar.hasAttribute("data-uploading")).toBe(true);
  });

  it("반올림해 100 이 되는 값은 99 — 올리기가 끝나기 전엔 100% 를 보이지 않는다", () => {
    const avatar = render(<Avatar name="한지우" uploadProgress={0.996} />);
    expect(bar(avatar)!.getAttribute("aria-valuenow")).toBe("99");
    act(() => root.render(<Avatar name="한지우" uploadProgress={1} />));
    expect(bar(container)!.getAttribute("aria-valuenow")).toBe("100");
  });

  it("이름(uploadLabel)은 부르는 쪽이 바꿀 수 있고, 0 ~ 1 밖의 값은 끝에서 멈춘다", () => {
    const avatar = render(
      <Avatar
        name="한지우"
        uploadProgress={1.7}
        uploadLabel="Uploading photo"
      />,
    );
    expect(bar(avatar)!.getAttribute("aria-label")).toBe("Uploading photo");
    expect(bar(avatar)!.getAttribute("aria-valuenow")).toBe("100");
    act(() => root.render(<Avatar name="한지우" uploadProgress={-1} />));
    expect(bar(container)!.getAttribute("aria-valuenow")).toBe("0");
  });

  it("올리는 동안은 숨기지 않는다 — 이름이 있으면 role=group(role=img 는 안의 진행 원을 읽지 않는다), 장식이어도 진행 원은 읽힌다", () => {
    const named = render(
      <Avatar name="한지우" decorative={false} uploadProgress={0.2} />,
    );
    expect(named.getAttribute("role")).toBe("group");
    expect(named.getAttribute("aria-label")).toBe("한지우");
    act(() => root.render(<Avatar name="한지우" uploadProgress={0.2} />));
    const deco = container.firstElementChild!;
    expect(deco.hasAttribute("aria-hidden")).toBe(false);
    expect(deco.hasAttribute("role")).toBe(false);
    expect(bar(container)).not.toBeNull();
  });
});

describe("AvatarPhotoEdit — 사진 바꾸기 자리", () => {
  const buttons = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
  const edit = (props: Partial<Parameters<typeof AvatarPhotoEdit>[0]> = {}) => (
    <AvatarPhotoEdit
      name="한지우"
      src="/p.png"
      changeLabel="사진 바꾸기"
      removeLabel="사진 지우기"
      onChange={() => undefined}
      onRemove={() => undefined}
      {...props}
    />
  );

  it("아바타 108 아래 16 에 버튼 둘이 늘 보인다 — 사이 8 · 가운데 · 좁으면 줄 바꿈", () => {
    const wrap = render(edit());
    expect(wrap.className).toEqual(
      expect.stringContaining("flex flex-col items-center gap-x4"),
    );
    const avatar = wrap.querySelector<HTMLElement>("[data-slot=avatar]")!;
    expect(avatar.className).toContain("size-[108px]");
    expect(avatar.getAttribute("role")).toBe("img");
    const actions = wrap.querySelector<HTMLElement>(
      "[data-slot=avatar-edit-actions]",
    )!;
    expect(avatar.nextElementSibling).toBe(actions);
    expect(actions.className).toEqual(
      expect.stringContaining("flex flex-wrap justify-center gap-x2"),
    );
    // 마우스를 올려야 나타나는 덮개가 없다 — 올림에 기대는 클래스가 없다
    expect(wrap.innerHTML).not.toMatch(/group-hover|opacity-0/);
  });

  it('"사진 바꾸기" neutralWeak small · "사진 지우기" ghost small — 누르면 각 콜백', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    render(edit({ onChange, onRemove }));
    const [change, remove] = buttons();
    expect(change!.textContent).toBe("사진 바꾸기");
    expect(remove!.textContent).toBe("사진 지우기");
    expect(change!.className).toContain("h-[36px]");
    expect(remove!.className).toContain("h-[36px]");
    expect(change!.className).not.toBe(remove!.className);
    act(() => change!.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => remove!.click());
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('사진이 없으면 "사진 바꾸기" 하나뿐이다(이니셜) — 이름 · 문구는 부르는 쪽이 넘긴 것', () => {
    render(edit({ src: undefined, changeLabel: "Change photo" }));
    expect(buttons().map((b) => b.textContent)).toEqual(["Change photo"]);
    expect(initial(container)!.textContent).toBe("한");
    act(() => root.render(edit({ src: "" })));
    expect(buttons()).toHaveLength(1);
  });

  it("올리는 중에는 두 버튼이 막히고 아바타에 덮개가 선다 — 끝나면 풀린다", () => {
    const onChange = vi.fn();
    render(edit({ uploadProgress: 0.4, onChange }));
    expect(buttons().every((b) => b.disabled)).toBe(true);
    act(() => buttons()[0]!.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(
      container
        .querySelector("[data-slot=progress-circle]")!
        .getAttribute("aria-valuetext"),
    ).toBe("40%");
    act(() => root.render(edit({ uploadProgress: undefined })));
    expect(buttons().every((b) => !b.disabled)).toBe(true);
    expect(container.querySelector("[data-slot=avatar-upload]")).toBeNull();
  });

  it("className · ref 는 바깥 묶음으로", () => {
    const ref = createRef<HTMLDivElement>();
    const wrap = render(edit({ ref, className: "mx-auto" }));
    expect(ref.current).toBe(wrap);
    expect(wrap.className).toContain("mx-auto");
  });
});

describe("AvatarStack", () => {
  it('앞 4명 + "+N" — 안의 아바타는 묶음 크기를 따르고 따로 읽지 않는다', () => {
    const stack = render(
      <AvatarStack size={36}>
        {PEOPLE.map((name) => (
          <Avatar key={name} name={name} size={96} decorative={false} />
        ))}
      </AvatarStack>,
    );
    expect(stack.dataset.slot).toBe("avatar-stack");
    // 이름이 없으면 장식 — 옆 글이 수를 말한다
    expect(stack.getAttribute("aria-hidden")).toBe("true");
    expect(stack.hasAttribute("role")).toBe(false);
    const avatars = Array.from(
      stack.querySelectorAll<HTMLElement>("[data-slot=avatar]"),
    );
    expect(avatars).toHaveLength(4);
    for (const avatar of avatars) {
      expect(avatar.className).toContain("size-[36px]");
      expect(avatar.hasAttribute("role")).toBe(false);
      expect(avatar.getAttribute("aria-hidden")).toBe("true");
    }
    expect(avatars.map((a) => initial(a)!.textContent)).toEqual([
      "김",
      "이",
      "박",
      "최",
    ]);
    const more = stack.querySelector("[data-slot=avatar-stack-overflow]")!;
    expect(more.textContent).toBe("+2");
    expect(more.getAttribute("aria-hidden")).toBe("true");
    expect(more.className).toContain("size-[36px]");
    expect(more.className).toContain("text-[13px]");
    // 겹침 · 링 두께는 크기마다(36 — 8 · 2)
    expect(stack.className).toContain("[&>*+*]:-ml-[8px]");
    expect(stack.className).toContain("[--avatar-stack-ring-width:2px]");
  });

  it('4명 이하면 모두 보이고 "+N" 이 없다', () => {
    const stack = render(
      <AvatarStack>
        {PEOPLE.slice(0, 4).map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarStack>,
    );
    expect(stack.querySelectorAll("[data-slot=avatar]")).toHaveLength(4);
    expect(stack.querySelector("[data-slot=avatar-stack-overflow]")).toBeNull();
    // 기본 24
    expect(stack.querySelector("[data-slot=avatar]")!.className).toContain(
      "size-[24px]",
    );
  });

  it("넘친 사람이 99 를 넘으면 +99, max 로 보이는 수를 바꾼다", () => {
    const many = render(
      <AvatarStack>
        {Array.from({ length: 128 }, (_, i) => (
          <Avatar key={i} name={`사람 ${i}`} />
        ))}
      </AvatarStack>,
    );
    expect(
      many.querySelector("[data-slot=avatar-stack-overflow]")!.textContent,
    ).toBe("+99");

    const two = render(
      <AvatarStack max={2}>
        {PEOPLE.slice(0, 5).map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarStack>,
    );
    expect(two.querySelectorAll("[data-slot=avatar]")).toHaveLength(2);
    expect(
      two.querySelector("[data-slot=avatar-stack-overflow]")!.textContent,
    ).toBe("+3");
  });

  it("이름을 주면 묶음을 그림 하나로 읽는다", () => {
    const stack = render(
      <AvatarStack aria-label="참여자 6명: 김민수, 이서연, 박지훈, 최유진 외 2명">
        {PEOPLE.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarStack>,
    );
    expect(stack.getAttribute("role")).toBe("img");
    expect(stack.hasAttribute("aria-hidden")).toBe(false);
    expect(stack.getAttribute("aria-label")).toBe(
      "참여자 6명: 김민수, 이서연, 박지훈, 최유진 외 2명",
    );
  });

  it("링 색은 놓인 바탕 — 시트 안이면 floating", () => {
    const plain = render(
      <AvatarStack>
        <Avatar name="김민수" />
      </AvatarStack>,
    );
    expect(plain.className).toContain(
      "[--avatar-stack-ring-color:var(--color-bg-layer-default)]",
    );
    const sheet = render(
      <AvatarStack surface="floating">
        <Avatar name="김민수" />
      </AvatarStack>,
    );
    expect(sheet.className).toContain(
      "[--avatar-stack-ring-color:var(--color-bg-layer-floating)]",
    );
  });
});

describe("AvatarStack — 놓인 폭에 맞춰 보이는 사람 수(03-E 결정 4 B)", () => {
  // 스펙 예: 108 · 6명 · W 312 → c = 1 + ⌊204 ÷ 81⌋ = 3 → 2명 + "+4"
  it("보이는 사람 = min(4, c − 1), 가장 적어도 1명 — 셈", () => {
    expect(avatarStackVisible(6, 4, 108, 312)).toBe(2);
    // 폰 안쪽 폭 312 에서 64 까지는 늘 앞 4명(64 · 5원 256), 80 부터 줄어든다
    expect(avatarStackVisible(6, 4, 64, 312)).toBe(4);
    expect(avatarStackVisible(6, 4, 80, 312)).toBe(3);
    expect(avatarStackVisible(6, 4, 96, 312)).toBe(3);
    // 모두(4명 이하)가 들면 모두 — 4명 108 은 지름 + 3 × 81 = 351 > 312 라 줄어든다
    expect(avatarStackVisible(4, 4, 24, 312)).toBe(4);
    expect(avatarStackVisible(4, 4, 108, 312)).toBe(2);
    expect(avatarStackVisible(4, 4, 108, 351)).toBe(4);
    // 폭이 한 원도 안 들어가도 가장 적어도 1명
    expect(avatarStackVisible(6, 4, 108, 100)).toBe(1);
    // 폭을 모르면 max 대로 · 사람이 적으면 있는 만큼
    expect(avatarStackVisible(6, 4, 108, null)).toBe(4);
    expect(avatarStackVisible(2, 4, 108, null)).toBe(2);
    expect(avatarStackVisible(0, 4, 24, 312)).toBe(0);
  });

  it('부모 폭이 바뀌면 다시 세고, 이름 함수의 "외 N명" 도 같이 바뀐다', () => {
    let notify: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    let width = 312;
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => width);
    const names = PEOPLE;
    const stack = render(
      <div>
        <AvatarStack
          size={108}
          aria-label={({ shown, rest, total }) =>
            `참여자 ${total}명: ${names.slice(0, shown).join(", ")}${rest > 0 ? ` 외 ${rest}명` : ""}`
          }
        >
          {names.map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarStack>
      </div>,
    ).firstElementChild as HTMLElement;
    const shown = () => stack.querySelectorAll("[data-slot=avatar]").length;
    const plus = () =>
      stack.querySelector("[data-slot=avatar-stack-overflow]")?.textContent;
    expect(shown()).toBe(2);
    expect(plus()).toBe(`+${names.length - 2}`);
    expect(stack.getAttribute("aria-label")).toBe(
      `참여자 ${names.length}명: ${names.slice(0, 2).join(", ")} 외 ${names.length - 2}명`,
    );
    // 화면이 넓어지면 보이는 사람이 늘고 "+N" · 이름이 같이 바뀐다
    width = 600;
    act(() => notify());
    expect(shown()).toBe(4);
    expect(plus()).toBe(`+${names.length - 4}`);
    expect(stack.getAttribute("aria-label")).toContain(
      `외 ${names.length - 4}명`,
    );
    expect(stack.dataset.shown).toBe("4");
    clientWidth.mockRestore();
  });
});
