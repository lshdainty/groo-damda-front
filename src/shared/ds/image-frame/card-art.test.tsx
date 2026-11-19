// Card Art 의 동작 — 크기 · 색 · 글자는 scripts/check-ds-spec.mjs 가 맞춘다. 여기는 카드사 가름 · 카드 면 크기 · 이름 · 긴 이름.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CardArt } from "./card-art";
import { fakeImage } from "./test-utils";

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

describe("CardArt", () => {
  it("아는 카드사에 그림이 없으면 기관 색 한 색 면 — 광택 · 그라디언트가 없다", () => {
    const el = render(
      <CardArt width={160} issuer="NH농협카드" name="올원 카드" />,
    );
    expect(el.dataset.issuer).toBe("known");
    const face = el.querySelector<HTMLElement>("[data-slot=card-art-face]")!;
    expect(face.style.backgroundColor).toBe("rgb(0, 166, 81)"); // #00A651
    expect(face.dataset.text).toBe("dark");
    expect(face.className).toContain("text-fg-neutral");
    expect(face.style.backgroundImage).toBe("");
    expect(face.querySelector("[data-slot=card-art-issuer]")!.textContent).toBe(
      "NH농협카드",
    );
    expect(face.querySelector("[data-slot=card-art-name]")!.textContent).toBe(
      "올원 카드",
    );
    expect(el.querySelector("[data-slot=content-placeholder]")).toBeNull();
  });

  it("흰 글자 카드사는 static-white", () => {
    const el = render(<CardArt width={160} issuer="신한카드" name="Deep" />);
    expect(el.querySelector("[data-slot=card-art-face]")!.className).toContain(
      "text-static-white",
    );
  });

  it("모르는 카드사는 회사 색인 척하지 않고 대체 그림(credit-card)", () => {
    const el = render(<CardArt width={160} issuer="어떤카드사" name="카드" />);
    expect(el.dataset.issuer).toBe("unknown");
    expect(el.querySelector("[data-slot=card-art-face]")).toBeNull();
    expect(el.querySelector("[data-slot=content-placeholder]")).not.toBeNull();
    expect(el.querySelector("svg.lucide-credit-card")).not.toBeNull();
  });

  it("그림이 못 불러와지면 카드 면으로 바뀐다", () => {
    const el = render(
      <CardArt width={160} issuer="롯데카드" name="LOCA" src="x.png" />,
    );
    expect(el.querySelector("[data-slot=card-art-face]")).toBeNull();
    act(() => {
      el.querySelector("img")!.dispatchEvent(new Event("error"));
    });
    expect(el.querySelector("[data-slot=card-art-face]")).not.toBeNull();
  });

  it("그림이 있으면 그림 — 세로 그림은 돌린다, 비율은 늘 카드", () => {
    const el = render(
      <CardArt width={160} issuer="삼성카드" name="카드" src="x.png" />,
    );
    expect(el.className).toContain("aspect-[1.586]");
    const image = el.querySelector("img")!;
    fakeImage(image, { width: 540, height: 856 });
    act(() => {
      image.dispatchEvent(new Event("load"));
    });
    expect(el.dataset.rotated).toBe("true");
  });

  it("작은 면은 회사 첫 글자만 가운데, medium · large 는 글 묶음(틀의 폭으로 갈린다)", () => {
    const el = render(<CardArt width={56} issuer="KB국민카드" name="노리2" />);
    const initial = el.querySelector("[data-slot=card-art-initial]")!;
    expect(initial.textContent).toBe("K");
    expect(initial.className).toContain("max(10px,round(40cqh,1px))");
    const label = el.querySelector("[data-slot=card-art-label]")!;
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("@min-[240px]/image-frame:px-x4");
  });

  it("면 모양은 폭으로만 가른다 — 96 미만 첫 글자, 96 이상 회사 · 카드 이름(글자 배율로 고르는 판단 없음 — groo-design #264)", () => {
    const el = render(
      <CardArt width={110} issuer="KB국민카드" name="가람 체크" />,
    );
    const initial = el.querySelector("[data-slot=card-art-initial]")!.className;
    const label = el.querySelector("[data-slot=card-art-label]")!.className;
    expect(initial.split(" ")).toContain("@min-[96px]/image-frame:hidden");
    expect(label.split(" ")).toContain("@min-[96px]/image-frame:flex");
    // 높이 · rem 으로 가르던 컨테이너 쿼리(글자 배율 판단)가 남지 않는다
    expect(initial).not.toMatch(/height|rem/);
    expect(label).not.toMatch(/height|rem/);
  });

  it("회사 · 카드 이름은 글자 크기 설정을 따르지 않는다 — medium t2 · t4, large t3 · t5 모두 -static(card-art.yaml)", () => {
    const el = render(
      <CardArt width={282} issuer="KB국민카드" name="가람 체크" />,
    );
    const issuer = el.querySelector("[data-slot=card-art-issuer]")!.className;
    const name = el.querySelector("[data-slot=card-art-name]")!.className;
    expect(issuer.split(" ")).toEqual(
      expect.arrayContaining([
        "text-t2-static",
        "@min-[240px]/image-frame:text-t3-static",
      ]),
    );
    expect(name.split(" ")).toEqual(
      expect.arrayContaining([
        "text-t4-static",
        "@min-[240px]/image-frame:text-t5-static",
      ]),
    );
    expect(`${issuer} ${name}`).not.toMatch(/text-t\d+(?!\d|-static)/);
  });

  it("아주 긴 이름 — 회사는 한 줄 말줄임, 카드 이름은 medium 한 줄 · large 두 줄(단어 단위)", () => {
    const el = render(
      <CardArt
        width={282}
        issuer="아주아주아주아주 긴 카드사 이름 NH농협카드"
        name={"이름이 아주아주 ".repeat(8)}
      />,
    );
    expect(
      el.querySelector("[data-slot=card-art-issuer]")!.className,
    ).toContain("truncate");
    const name = el.querySelector("[data-slot=card-art-name]")!;
    expect(name.className).toContain("line-clamp-1");
    expect(name.className).toContain("@min-[240px]/image-frame:line-clamp-2");
    expect(name.className).toContain("break-keep");
  });

  it("카드 이름이 비면 이름 줄이 없다", () => {
    const el = render(<CardArt width={160} issuer="우리카드" name="  " />);
    expect(el.querySelector("[data-slot=card-art-name]")).toBeNull();
  });

  it("decorative 기본 — 옆에 이름이 있으니 숨긴다, false 면 '카드사 카드 이름' 을 읽는다", () => {
    const hidden = render(
      <CardArt width={160} issuer="우리카드" name="정석" />,
    );
    expect(
      hidden
        .querySelector("[data-slot=image-frame-fallback]")!
        .getAttribute("aria-hidden"),
    ).toBe("true");
    const named = render(
      <CardArt width={160} issuer="우리카드" name="정석" decorative={false} />,
    );
    const fallback = named.querySelector("[data-slot=image-frame-fallback]")!;
    expect(fallback.getAttribute("role")).toBe("img");
    expect(fallback.getAttribute("aria-label")).toBe("우리카드 정석");
    const withImage = render(
      <CardArt
        width={160}
        issuer="우리카드"
        name="정석"
        src="x.png"
        decorative={false}
      />,
    );
    expect(withImage.querySelector("img")!.alt).toBe("우리카드 정석");
  });
});
