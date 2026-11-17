/*
 * 키보드가 떠 있는 동안 레이아웃 뷰포트 아래 띠를 딤으로 덮는 덮개 — 딤의 거울을 문서 쪽(position: absolute)에 둔다.
 *
 * iPhone Safari 26 은 키보드가 뜨면 보이는 영역을 밀어(offsetTop) 그 아래 끝을 레이아웃 뷰포트의 아래 끝에 맞추고, 그 아래 —
 * 떠 있는 주소 알약 둘레에서 키보드 윗변까지(입력 도구줄이 없을 때 약 98pt) — 에 문서를 그린다(2026-11-17 QA 실측 ·
 * iPhone 17 Pro: 레이아웃 714 · 숫자 키패드 보이는 영역 410 · 밀림 304). 그런데 `position: fixed` 인 것은 그 자식 · 의사 요소까지
 * 레이아웃 뷰포트 밖으로는 그리지 않는다 — 딤(fixed inset-0)도, 딤 아래에 붙인 ::after(#616)도 띠에 닿지 않아 뒤 페이지
 * (할 일 목록 · 바탕)가 흐림 없이 비쳤다(QA: 띠 245,246,250 · 위 딤 127). 같은 벽이 알려져 있다 — "iOS 26 Safari will not
 * render position: fixed content below the browser controls"(Apple Developer Forums 800798). 딤을 더 길게 그려도 같다.
 *
 * 그래서 띠는 문서 쪽에서 덮는다 — body 에 `position: absolute` 덮개를 레이아웃 뷰포트 아래 끝(문서 기준
 * 스크롤 + clientHeight)부터 화면 높이만큼 둔다. 문서 흐름이라 Safari 가 띠에 그대로 그린다. 레이아웃 뷰포트 안은 덮지 않는다
 * — 거기는 딤이 덮으니 겹치면 두 번 어두워진다.
 *
 * 덮개는 딤의 거울이다 — 딤의 속성(class · data-state · vaul 의 data-vaul-*)을 그대로 옮겨 색(라이트 · 다크) · 층(z) · 나타남 ·
 * 사라짐(모션 줄이기 포함)이 딤과 같고, 딤에 인라인으로 들어오는 투명도 · 전환(vaul) · pointer-events(Radix)도 따른다. 딤이 닫히면
 * (data-state=closed) 덮개도 딤과 같은 모션으로 사라진다. 자리(position · top · left · right · bottom · height)만 인라인으로 덮는다.
 * 키보드가 없을 때는 만들지 않는다 — 키보드 없는 시트 · 대화상자의 모습은 그대로다.
 */

/** 덮개가 스스로 정하는 속성 — 딤에서 옮기지 않는다 */
const OWN_ATTRIBUTES = new Set(["style", "id", "data-slot", "aria-hidden"]);

/**
 * 딤에 인라인으로 들어오는 것 — 덮개도 같이 따른다. 투명도는 끄는 동안 vaul 이, pointer-events 는 Radix 가 넣는다
 * (열린 동안 body 는 pointer-events: none 이라 딤만 누를 수 있다 — 띠를 눌러도 딤을 누른 것과 같다)
 */
const MIRRORED_STYLES = ["opacity", "pointer-events"] as const;

export type KeyboardBand = {
  /** 덮개를 레이아웃 뷰포트(높이 layoutHeight) 아래 끝에 둔다 — 없으면 만든다 */
  show: (layoutHeight: number) => void;
  /** 덮개를 걷는다 */
  hide: () => void;
};

export function keyboardBand(dim: HTMLElement): KeyboardBand {
  const band = dim.ownerDocument.createElement("div");
  band.setAttribute("data-slot", "keyboard-band");
  band.setAttribute("aria-hidden", "true");

  const mirror = () => {
    for (const name of band.getAttributeNames()) {
      if (!OWN_ATTRIBUTES.has(name) && !dim.hasAttribute(name)) {
        band.removeAttribute(name);
      }
    }
    for (const name of dim.getAttributeNames()) {
      if (!OWN_ATTRIBUTES.has(name)) {
        band.setAttribute(name, dim.getAttribute(name) ?? "");
      }
    }
    for (const prop of MIRRORED_STYLES) {
      const value = dim.style.getPropertyValue(prop);
      if (value) {
        band.style.setProperty(
          prop,
          value,
          dim.style.getPropertyPriority(prop),
        );
      } else {
        band.style.removeProperty(prop);
      }
    }
    // 전환은 딤에 실제로 걸린 값 그대로 — 시트 딤은 끄는 동안(바로 뒤 시트에 .vaul-dragging)만 클래스의 !important 전환이 빠지고
    // vaul 이 넣는 인라인 값(none)이 이긴다. 덮개 뒤에는 시트가 없어 그 조건이 늘 거짓이라 계산된 값을 인라인 !important 로 옮긴다
    const transition = getComputedStyle(dim).transition;
    if (transition)
      band.style.setProperty("transition", transition, "important");
    else band.style.removeProperty("transition");
  };
  const observer = new MutationObserver(mirror);

  const place = (layoutHeight: number) => {
    const style = band.style;
    // 딤의 fixed inset-0 을 자리만 덮어쓴다 — 문서 쪽에 두고 레이아웃 뷰포트 아래에서 시작한다
    style.position = "absolute";
    style.left = "0px";
    style.right = "0px";
    style.bottom = "auto";
    // 띠는 화면 높이에서 레이아웃 뷰포트를 뺀 것보다 작다 — 화면 높이면 넉넉하다
    style.height = `${Math.max(window.screen?.height || 0, layoutHeight)}px`;
    // 기댈 상자(보통 문서 — Radix 스크롤 잠금이 body 를 relative 로 두면 body)의 위 끝이 레이아웃 뷰포트에서 어디인지 재고
    // 레이아웃 뷰포트 아래 끝까지 내린다. 문서가 스크롤돼 있어도(폰 셸은 문서가 스크롤한다) 맞는다
    style.top = "0px";
    const origin = band.getBoundingClientRect().top;
    style.top = `${Math.round(layoutHeight - origin)}px`;
  };

  return {
    show(layoutHeight) {
      if (!band.isConnected) {
        mirror();
        dim.ownerDocument.body.appendChild(band);
        observer.observe(dim, { attributes: true });
      }
      place(layoutHeight);
    },
    hide() {
      observer.disconnect();
      band.remove();
    },
  };
}

/** 표면 바로 앞 형제인 딤(data-slot 이 "-overlay" 로 끝나는 것) — 시트 · 대화상자 모두 Portal 안에서 딤 → 표면 순이다 */
export function dimBefore(surface: HTMLElement) {
  const prev = surface.previousElementSibling;
  return prev instanceof HTMLElement &&
    prev.getAttribute("data-slot")?.endsWith("-overlay")
    ? prev
    : null;
}
