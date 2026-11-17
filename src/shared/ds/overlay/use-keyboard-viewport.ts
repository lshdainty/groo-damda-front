import * as React from "react";

/** 이만큼 넘게 가려야 키보드로 본다 — 주소창이 접히고 펴지는 정도(수십 px)는 키보드가 아니다. */
export const KEYBOARD_MIN_PX = 60;

/**
 * iPhone Safari 26 이상의 입력 도구줄(∧ · ∨ · 완료 — 떠 있는 유리 알약)이 보이는 영역 아래쪽을 덮는 높이.
 *
 * 26 부터 이 줄은 키보드 위에 떠서 페이지 위에 겹쳐 그려지고 visualViewport 는 키보드 윗변까지를 보이는 영역으로
 * 준다 — 도구줄이 덮는 만큼은 재지 못한다. 그래서 키보드 높이에 이 값을 더해 "도구줄까지 넣어" 잰다
 * (Layout › Safe Area "화면 키보드"). 값은 QA 화면(2026-11-16 · iPhone 17 시뮬레이터 세로 · 가로)에서 잰 도구줄
 * 윗변 ↔ 키보드 윗변 거리 53 ~ 57 을 덮는 56 이다. iPad(도구줄이 키보드 안) · 25 이하(줄이 키보드에 붙어
 * visualViewport 가 이미 뺀다) · 다른 브라우저는 0.
 */
export const IOS_FLOATING_ACCESSORY_PX = 56;

/** 입력 도구줄이 보이는 영역 위에 떠서 겹치는 브라우저면 그 높이 — iPhone 의 Safari 26 이상. 아니면 0 */
export function floatingAccessoryHeight(
  ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  if (!/iPhone/.test(ua)) return 0;
  const version = /Version\/(\d+)/.exec(ua);
  return version && Number(version[1]) >= 26 ? IOS_FLOATING_ACCESSORY_PX : 0;
}

/**
 * 레이아웃 뷰포트 높이 — `position: fixed` 의 기준. `documentElement.clientHeight` 로 잰다.
 *
 * `innerHeight` 가 아니다 — iOS Safari 는 키보드가 뜬 채 페이지가 스크롤되면 innerHeight 를 스크롤만큼 줄인다
 * (실측 714 → 625). 그걸로 재면 키보드 높이가 그만큼 모자라 시트 아래 변이 키보드 · 입력 도구줄 밑으로 들어간다
 * (그루 계정 웹 GA-02 와 같은 함정). clientHeight 는 그대로다. 레이아웃 뷰포트가 키보드와 함께 줄어드는
 * 브라우저(삼성 인터넷)는 clientHeight 도 같이 줄어 판정이 그대로다. 스낵바도 같은 값을 쓴다.
 */
function layoutViewportHeight() {
  return document.documentElement.clientHeight;
}

/** 키보드가 떠 있을 때 쓸 수 있는 영역 — 레이아웃 뷰포트 기준 위치(top)와 높이(떠 있는 도구줄을 뺐다). */
export type KeyboardViewport = { top: number; height: number };

/**
 * 지금 키보드가 화면을 가리고 있으면 쓸 수 있는 영역(보이는 영역에서 떠 있는 입력 도구줄을 뺀 것)을, 아니면 null 을 준다.
 *
 * 가린 높이는 `레이아웃 높이 − visualViewport.height × scale` 이다 — 손가락으로 확대(scale > 1)하면 보이는
 * 높이가 배율만큼 줄 뿐 가린 것은 없으므로 배율을 되돌려 잰다. 레이아웃 뷰포트까지 함께 줄어드는
 * 브라우저(삼성 인터넷)는 두 값이 같이 줄어 0 이 된다 — 그때는 dvh 가 이미 줄어 손댈 일이 없다.
 * `layoutHeight` 는 레이아웃 뷰포트 높이(기본 layoutViewportHeight — documentElement.clientHeight).
 */
export function readKeyboardViewport(
  layoutHeight: number = layoutViewportHeight(),
): KeyboardViewport | null {
  const vv = window.visualViewport;
  if (!vv) return null;
  const scale = vv.scale || 1;
  const covered = layoutHeight - vv.height * scale;
  if (covered <= KEYBOARD_MIN_PX) return null;
  return {
    top: vv.offsetTop || 0,
    height: Math.max(vv.height - floatingAccessoryHeight(), 0),
  };
}

/**
 * 레이아웃 뷰포트 아래에서 키보드(입력 도구줄 포함)가 가린 높이 — `position: fixed; bottom` 에 그대로 쓴다.
 * 키보드가 없으면 0. 바닥에 서는 것(시트 · 스낵바)이 같은 값을 쓴다.
 */
export function keyboardBottomInset(
  layoutHeight: number = layoutViewportHeight(),
) {
  const kb = readKeyboardViewport(layoutHeight);
  if (!kb) return 0;
  return Math.max(Math.round(layoutHeight - (kb.top + kb.height)), 0);
}

/**
 * 키보드가 떠 있는 동안 표면(시트 · 대화상자)을 **보이는 영역** 안에 두고, 초점 칸 전체가 키보드 · 바닥 버튼 위에
 * 보이게 본문을 스크롤한다.
 *
 * iOS Safari(그리고 안드로이드 크롬 108+ 의 기본값)는 키보드가 떠도 레이아웃 뷰포트 — `100vh` · `100dvh` ·
 * `position: fixed` 의 기준 — 를 줄이지 않고 보이는 영역(visual viewport)만 줄인다. 그래서 `bottom: 0` ·
 * `max-height: 90dvh` 로 선 시트는 키보드 뒤에 깔리고, 브라우저가 초점 칸을 보이려고 보이는 영역을 아래로
 * 밀어 올리면(offsetTop) 시트 머리가 화면 위로 나간다. 문서 스크롤은 잠겨 있어 끌어도 돌아오지 않는다
 * (2026-11-16 QA — 거래 추가 시트의 머리 · 종류 칩 · 금액 칸이 사라짐, 2단계 [추가] 가 도구줄 밑).
 *
 * 규칙(Layout › Safe Area "화면 키보드" · bottom-sheet.md 키보드(폰) · "키보드로 넘친 것 — 본문만 스크롤, 머리 · 바닥은
 * 그대로", dialog.md "머리 · 바닥이 화면 밖으로 나가지 않습니다")을 쓸 수 있는 영역(readKeyboardViewport)에 건다.
 *   - 높이 상한은 **쓸 수 있는 높이 × ratio**(시트 0.9 · 대화상자 0.8 — 클래스의 dvh 비율과 같다). 넘치는 만큼
 *     본문(min-h-0 flex-1)만 줄어 스크롤하고 머리 · 바닥은 남는다.
 *   - bottom — 시트의 아래 변을 키보드(입력 도구줄 포함) 윗변에 붙인다(keyboardBottomInset). 보이는 영역이
 *     밀려 올라가도(offsetTop) 그만큼 따라간다.
 *   - center — 대화상자의 가운데를 쓸 수 있는 영역의 가운데에 둔다(클래스의 −translate-y-1/2 는 그대로).
 *   - 초점 칸 — 키보드가 뜰 때 · 높이가 바뀔 때 · 초점이 옮겨 갈 때, 초점 칸 전체가 본문의 보이는 칸(scroll-padding —
 *     끝 흐림 위 20 · 아래 80 — 을 뺀 안쪽) 안에 오게 본문을 스크롤한다(revealFocused). 바닥 버튼은 본문 밖이라 칸이
 *     바닥 위에 선다. 보이는 영역을 밀기만 할 때(scroll)는 하지 않는다 — 손으로 본문을 보는 중에 끌어당기지 않게.
 *   - 쓸 수 있는 영역이 머리 · 바닥만으로 차 본문에 초점 칸 하나도 안 들어가면(가로 화면의 폰) 본문만 스크롤하는
 *     규칙을 지킬 수 없다 — 그때만 표면 전체가 스크롤하고 초점 칸을 그 안에서 보이게 한다(isCramped · setCramped).
 * 키보드가 없으면 박은 값을 모두 걷는다 — 그때는 클래스(dvh)가 정한다. 키보드가 떠 있는 동안 표면에
 * `data-keyboard`(fit · cramped)를 단다.
 *
 * 듣는 것: visualViewport `resize` · `scroll`(iOS 는 높이를 바꾸지 않고 밀기만 하거나 resize 없이 끝난다) ·
 * window `resize` · 문서 `focusin` · `focusout`. 마운트 때도 한 번 — 키보드가 떠 있는 채 열린 겹친 시트가 바로 맞게.
 * 그때그때 바로 고친다(다음 프레임으로 미루면 밀리는 동안 시트가 한 박자씩 늦게 따라와 흔들린다).
 *
 * vaul 의 `repositionInputs` 는 끈다(bottom-sheet.tsx) — 이 일을 vaul 도 하는데, 키보드 높이(innerHeight − height)만
 * 보고 보이는 영역이 밀린 것(offsetTop) · 떠 있는 도구줄은 보지 않으며, "열렸나" 를 뒤집기로 기억해 숫자 키패드 ↔
 * 글자 키보드에서 어긋났다(2026-09-18 · 11-10). 한 자리에서 한 규칙으로만 정한다.
 */
export function useKeyboardViewport(
  targetRef: React.RefObject<HTMLElement | null>,
  placement: "bottom" | "center",
  ratio: number,
) {
  React.useEffect(() => {
    // 구독은 마운트 시점의 객체에 건다. 값은 부를 때마다 다시 읽는다.
    const vvAtMount = window.visualViewport;
    // 지난번에 맞춘 쓸 수 있는 높이 — 키보드가 막 떴는지 · 높이가 바뀌었는지(초점 칸을 다시 보일 때)
    let lastHeight: number | null = null;
    const apply = (reveal: boolean) => {
      const el = targetRef.current;
      if (!el) return;
      const body = bodyOf(el);
      const kb = readKeyboardViewport();
      if (!kb) {
        lastHeight = null;
        el.style.removeProperty("max-height");
        el.style.removeProperty(placement === "bottom" ? "bottom" : "top");
        setCramped(el, body, false);
        el.removeAttribute("data-keyboard");
        return;
      }
      const maxHeight = Math.floor(kb.height * ratio);
      el.style.maxHeight = `${maxHeight}px`;
      if (placement === "bottom") {
        el.style.bottom = `${keyboardBottomInset()}px`;
      } else {
        el.style.top = `${Math.round(kb.top + kb.height / 2)}px`;
      }
      const cramped = body != null && isCramped(el, body, maxHeight);
      const wasCramped = el.getAttribute("data-keyboard") === "cramped";
      setCramped(el, body, cramped);
      el.setAttribute("data-keyboard", cramped ? "cramped" : "fit");
      const resized = lastHeight !== kb.height;
      lastHeight = kb.height;
      if (reveal || resized || cramped !== wasCramped) {
        // 좁을 때는 표면이, 아니면 본문이 스크롤 상자다
        const scroller = cramped ? el : body;
        if (scroller) revealFocused(el, scroller);
      }
    };
    const onFocus = () => apply(true);
    const onChange = () => apply(false);
    vvAtMount?.addEventListener("resize", onChange);
    vvAtMount?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onChange);
    onChange();
    return () => {
      vvAtMount?.removeEventListener("resize", onChange);
      vvAtMount?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onChange);
    };
  }, [targetRef, placement, ratio]);
}

/** 표면의 본문 — 바로 아래 자식 중 data-slot 이 "-body" 로 끝나는 것(bottom-sheet-body · dialog-body). */
function bodyOf(el: HTMLElement) {
  for (const child of Array.from(el.children)) {
    if (child.getAttribute("data-slot")?.endsWith("-body")) {
      return child as HTMLElement;
    }
  }
  return null;
}

/**
 * 초점 칸 전체가 스크롤 상자의 보이는 칸 안에 오게 상자만 스크롤한다. 보이는 칸은 상자에서 scroll-padding(끝 흐림이면
 * 위 20 · 아래 80)을 뺀 안쪽이다. 칸이 그보다 크면 칸의 위를 맞춘다. 문서 · 보이는 영역은 건드리지 않는다
 * (scrollIntoView 는 잠긴 문서까지 움직인다).
 */
function revealFocused(surface: HTMLElement, scroller: HTMLElement) {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || !surface.contains(focused)) return;
  if (focused === scroller || !scroller.contains(focused)) return;
  const box = scroller.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const top = box.top + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = box.bottom - (parseFloat(style.scrollPaddingBottom) || 0);
  const field = focused.getBoundingClientRect();
  if (field.height > bottom - top || field.top < top) {
    scroller.scrollTop -= top - field.top;
  } else if (field.bottom > bottom) {
    scroller.scrollTop += field.bottom - bottom;
  }
}

/**
 * 쓸 수 있는 영역이 머리 · 바닥만으로 거의 차서 본문에 입력 중인 칸 하나도 들어가지 않는가(가로 화면의 폰 — 보이는
 * 높이가 100px 남짓). 본문 몫 = 높이 상한 − 본문이 아닌 흐름 안 자식(머리 · 바닥 …)의 높이 − 표면 위아래 안 여백.
 * 입력 중인 칸이 본문 안에 있으면 그 칸의 높이, 없으면 1px 이 들어가야 한다.
 */
function isCramped(el: HTMLElement, body: HTMLElement, maxHeight: number) {
  const style = getComputedStyle(el);
  let chrome =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0);
  for (const child of Array.from(el.children)) {
    if (child === body) continue;
    const position = getComputedStyle(child).position;
    if (position === "absolute" || position === "fixed") continue;
    chrome += child.getBoundingClientRect().height;
  }
  const focused = document.activeElement;
  const need =
    focused instanceof HTMLElement && body.contains(focused)
      ? focused.getBoundingClientRect().height
      : 1;
  return maxHeight - chrome < need;
}

/**
 * 좁을 때는 본문만 스크롤하는 규칙을 지킬 수 없다 — 본문이 0 이 돼 입력 중인 칸이 사라진다. 그때만 표면 전체를
 * 스크롤 상자로 바꾸고(본문은 내용 높이로 편다) 입력 중인 칸이 보이게 한다. 머리 · 바닥은 그 스크롤 안에 있다.
 */
function setCramped(
  el: HTMLElement,
  body: HTMLElement | null,
  cramped: boolean,
) {
  if (cramped) {
    el.style.overflowY = "auto";
    el.style.overscrollBehavior = "contain";
    body?.style.setProperty("flex", "none");
    body?.style.setProperty("overflow-y", "visible");
    return;
  }
  el.style.removeProperty("overflow-y");
  el.style.removeProperty("overscroll-behavior");
  body?.style.removeProperty("flex");
  body?.style.removeProperty("overflow-y");
}
