import * as React from "react";

/** 이만큼 넘게 가려야 키보드로 본다 — 주소창이 접히고 펴지는 정도(수십 px)는 키보드가 아니다. */
export const KEYBOARD_MIN_PX = 60;

/**
 * iPhone 사파리에서 바닥 고정 버튼(시트 · 대화상자 바닥)을 보이는 영역 아래 끝에서 늘 띄우는 높이 — 입력 도구줄(∧ · ∨ · 완료)
 * 높이 56. DESIGN.md Layout › Safe Area "화면 키보드"(groo-design #241): "브라우저가 입력 도구줄을 보이는 영역에서 뺐는지
 * 알려 주지 않는 경우(iPhone 사파리), 바닥 고정 버튼은 보이는 영역 아래 끝에서 도구줄 높이(56)만큼 늘 띄웁니다."
 *
 * iPhone 17 Pro · Safari 26 실기기(2026-11-17 QA)는 키보드를 올릴 때마다 두 상태가 번갈아 나오고 둘을 가를 값을 주지 않는다 —
 *   (A) 주소 알약 · 도구줄이 뜨고 보이는 영역이 둘 다 빼고 준다(보이는 높이 384) — 56 을 띄우면 그만큼 빈틈이 생긴다.
 *   (B) 알약이 없고 보이는 영역이 키보드 윗변까지인데(보이는 높이 484) 도구줄이 그 안에 떠 바닥 [저장] · [다음] 을 덮어 누를 수
 *       없다(도구줄 자리의 터치를 OS 가 먹는다).
 * (A) 의 빈틈은 결함이 아니다 — 누를 수 없는 것(기능)을 빈틈(모양)보다 먼저 막는다(#613 의 "빈틈은 결함" 판정을 이 경우에 한해
 * 거뒀다). 토큰이 없어 스펙 값을 그대로 둔다.
 */
export const IPHONE_SAFARI_TOOLBAR_RESERVE_PX = 56;

/**
 * 바닥 고정 버튼을 보이는 영역 아래 끝에서 더 띄울 높이 — iPhone 사파리 26 이상이면 56, 아니면 0.
 *
 * 사파리만 가린다 — `Version/` 이 있고 다른 브라우저 표시(CriOS · FxiOS · EdgiOS · OPiOS)가 없는 iPhone. 26 부터 도구줄이 키보드
 * 위에 떠서 위 (A) · (B) 가 번갈아 난다(25 이하는 도구줄이 키보드에 붙어 보이는 영역이 늘 뺀다 — #606 때의 판정 그대로). 26 은
 * UA 의 OS 판이 18_6 으로 묶여 있어 `Version/` 으로 본다. iPad(데스크톱 UA) · 안드로이드 · 데스크톱은 0.
 */
export function keyboardToolbarReserve(
  ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  if (!/iPhone/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 0;
  const version = /Version\/(\d+)/.exec(ua);
  return version && Number(version[1]) >= 26
    ? IPHONE_SAFARI_TOOLBAR_RESERVE_PX
    : 0;
}

/**
 * 레이아웃 뷰포트 높이 — `position: fixed` 의 기준. `documentElement.clientHeight` 로 잰다.
 *
 * `innerHeight` 가 아니다 — iOS Safari 는 키보드가 뜬 채 페이지가 스크롤되면 innerHeight 를 스크롤만큼 줄인다
 * (실측 714 → 625). 그걸로 재면 키보드 높이가 그만큼 모자라 시트 아래 변이 키보드 밑으로 들어간다
 * (그루 계정 웹 GA-02 와 같은 함정). clientHeight 는 그대로다. 레이아웃 뷰포트가 키보드와 함께 줄어드는
 * 브라우저(삼성 인터넷)는 clientHeight 도 같이 줄어 판정이 그대로다. 스낵바 · 하단 탭 바도 같은 값을 쓴다.
 */
export function layoutViewportHeight() {
  return document.documentElement.clientHeight;
}

/** 키보드가 떠 있을 때 쓸 수 있는 영역 — 레이아웃 뷰포트 기준 위치(top)와 높이(= 보이는 영역). */
export type KeyboardViewport = { top: number; height: number };

/**
 * 지금 키보드가 화면을 가리고 있으면 쓸 수 있는 영역(보이는 영역 그대로)을, 아니면 null 을 준다.
 *
 * 보이는 영역(visualViewport) 그대로다 — 여기서는 아무것도 더 빼지 않는다. iPhone Safari 26 은 키보드 위에 떠 있는 주소
 * 알약 · 입력 도구줄(∧ · ∨ · 완료)을 뺀 때와 안 뺀 때(도구줄이 보이는 영역 안에 뜬다)가 번갈아 나오는데, 바닥 고정 버튼만
 * 그 몫을 늘 띄운다(keyboardToolbarReserve — 시트 · 대화상자의 useKeyboardViewport 가 건다).
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
    height: vv.height,
  };
}

/**
 * 레이아웃 뷰포트 아래에서 보이는 영역 밖으로 가려진 높이(키보드와 그 위에 떠 있는 알약 · 도구줄) —
 * `position: fixed; bottom` 에 그대로 쓴다.
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
 *   - 쓸 수 있는 영역 — 보이는 영역에서 아래 끝의 도구줄 몫(keyboardToolbarReserve — iPhone 사파리 56, 그 밖 0)을 뺀 것.
 *   - 높이 상한은 **쓸 수 있는 높이 × ratio**(시트 0.9 · 대화상자 0.8 — 클래스의 dvh 비율과 같다). 넘치는 만큼
 *     본문(min-h-0 flex-1)만 줄어 스크롤하고 머리 · 바닥은 남는다.
 *   - bottom — 시트의 아래 변을 보이는 영역의 아래 변(OS 가 그린 것 가운데 가장 위 — 떠 있는 주소 알약 · 도구줄 ·
 *     키보드)에 붙이고(keyboardBottomInset) 도구줄 몫만큼 더 띄운다. 보이는 영역이
 *     밀려 올라가도(offsetTop) 그만큼 따라간다.
 *   - center — 대화상자의 가운데를 쓸 수 있는 영역의 가운데에 둔다(클래스의 −translate-y-1/2 는 그대로).
 *   - 초점 칸 — 키보드가 뜰 때 · 높이가 바뀔 때 · 초점이 옮겨 갈 때, 초점 칸 전체가 본문의 보이는 칸(scroll-padding —
 *     끝 흐림 위 20 · 아래 80 — 을 뺀 안쪽) 안에 오게 본문을 스크롤한다(revealFocused). 바닥 버튼은 본문 밖이라 칸이
 *     바닥 위에 선다. 보이는 영역을 밀기만 할 때(scroll)는 하지 않는다 — 손으로 본문을 보는 중에 끌어당기지 않게.
 *   - 키보드가 내려가면 그렇게 넣은 스크롤을 되돌린다 — 본문이 다시 길어졌는데 넣은 스크롤이 남으면 칸 위 라벨이
 *     머리 밑에 가린 채로 있다(2026-11-17 QA — 거래 추가 2단계 "거래처"). 넣은 뒤 사용자가 직접 민 스크롤은 그대로 둔다.
 *   - 쓸 수 있는 영역이 머리 · 바닥만으로 차 본문에 초점 칸 하나도 안 들어가면(가로 화면의 폰) 본문만 스크롤하는
 *     규칙을 지킬 수 없다 — 그때만 표면 전체가 스크롤하고 초점 칸을 그 안에서 보이게 한다(isCramped · setCramped).
 * 키보드가 없으면 박은 값을 모두 걷는다 — 그때는 클래스(dvh)가 정한다. 키보드가 떠 있는 동안 표면에
 * `data-keyboard`(fit · cramped)를 단다. 딤은 손대지 않는다 — 늘 화면 위아래로 넘쳐 키보드 아래 띠까지 덮는다(dim-bounds.ts).
 *
 * 듣는 것: visualViewport `resize` · `scroll`(iOS 는 높이를 바꾸지 않고 밀기만 하거나 resize 없이 끝난다) ·
 * window `resize` · 문서 `focusin` · `focusout`. 마운트 때도 한 번 — 키보드가 떠 있는 채 열린 겹친 시트가 바로 맞게.
 * 그때그때 바로 고친다(다음 프레임으로 미루면 밀리는 동안 시트가 한 박자씩 늦게 따라와 흔들린다).
 *
 * vaul 의 `repositionInputs` 는 끈다(bottom-sheet.tsx) — 이 일을 vaul 도 하는데, 키보드 높이(innerHeight − height)만
 * 보고 보이는 영역이 밀린 것(offsetTop)은 보지 않으며, "열렸나" 를 뒤집기로 기억해 숫자 키패드 ↔
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
    // 키보드가 떠 있는 동안 초점 칸을 보이려고 넣은 스크롤 — 상자 · 넣기 전 자리(from) · 넣은 뒤 자리(to)
    let revealed: { scroller: HTMLElement; from: number; to: number } | null =
      null;
    const apply = (reveal: boolean) => {
      const el = targetRef.current;
      if (!el) return;
      const body = bodyOf(el);
      const layoutHeight = layoutViewportHeight();
      const kb = readKeyboardViewport(layoutHeight);
      if (!kb) {
        lastHeight = null;
        el.style.removeProperty("max-height");
        el.style.removeProperty(placement === "bottom" ? "bottom" : "top");
        setCramped(el, body, false);
        el.removeAttribute("data-keyboard");
        // 넣은 스크롤을 되돌린다 — 높이 상한을 걷은 뒤라 본문이 다시 길어진 상태에서 맞춘다. 넣은 뒤 자리에서
        // 움직였으면(사용자가 직접 밀었다) 손대지 않는다
        if (revealed && revealed.scroller.scrollTop === revealed.to) {
          revealed.scroller.scrollTop = revealed.from;
        }
        revealed = null;
        return;
      }
      // 바닥 고정 버튼을 도구줄 몫만큼 띄운다 — 그만큼 쓸 수 있는 높이도 준다
      const reserve = keyboardToolbarReserve();
      const usable = Math.max(kb.height - reserve, 0);
      const maxHeight = Math.floor(usable * ratio);
      el.style.maxHeight = `${maxHeight}px`;
      if (placement === "bottom") {
        el.style.bottom = `${keyboardBottomInset(layoutHeight) + reserve}px`;
      } else {
        el.style.top = `${Math.round(kb.top + usable / 2)}px`;
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
        if (scroller) {
          const before = scroller.scrollTop;
          revealFocused(el, scroller);
          const after = scroller.scrollTop;
          if (after !== before) {
            // 지난번에 넣은 자리 그대로면 처음 자리를 이어 간다 — 사이에 사용자가 밀었으면 그 자리부터 센다
            const from =
              revealed?.scroller === scroller && revealed.to === before
                ? revealed.from
                : before;
            revealed = { scroller, from, to: after };
          }
        }
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
