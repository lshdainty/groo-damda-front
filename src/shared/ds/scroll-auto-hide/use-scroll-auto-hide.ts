import * as React from "react";

/*
 * 스크롤하면 숨는 영역의 동작 — SEED Breeze ScrollAutoHide(Apache-2.0)를 옮긴 것이다. 옮긴 곳: github.com/daangn/seed-design
 * docs/registry/react/breeze/scroll-auto-hide/scroll-auto-hide.tsx(dev 045051f87f, 2026-08-13 — "harden scroll auto hide settling" #1997).
 * 동작은 SEED 그대로이고 바뀐 것은 이름뿐이다 — 스냅 200ms · cubic-bezier(0, 0, 0.15, 1) 을 groo 토큰 motion-duration-d4 ·
 * motion-ease-enter 로(값이 같다, v104). groo-design recipes/shadcn/components/ui/scroll-auto-hide.tsx 를 첫 판으로 가져왔다.
 *
 * 스크롤 상자 맨 위에 붙은 영역이 아래로 스크롤하면 그 거리만큼 위로 숨고, 위로 스크롤하면 같은 거리만큼 드러난다(1:1). 맨 위 근처에서는
 * 스크롤한 거리보다 더 숨지 않는다. 스크롤이 끝나면(scrollend — 없는 브라우저는 마지막 스크롤 120ms 뒤) 영역 높이의 50% 를 기준으로
 * 다 숨거나 다 드러난다 — 200ms motion-ease-enter. 키보드로 스크롤한 뒤에는 움직임 없이 바로 스냅한다.
 * 높이(레이아웃)를 바꾸지 않고 translate3d 로만 옮긴다 — 목록이 접히는 만큼 당겨지지 않는다. ScrollTimeline 이 있는 브라우저는 스크롤과
 * 이동을 브라우저가 잇고, 없으면 scroll 이벤트로 같은 일을 한다.
 * 모션 줄이기면 자동 숨김을 끈다(늘 보인다). 숨은 영역 안으로 키보드 초점이 오면 바로 다 드러낸다 — 보이지 않는 단추에 초점이 머물지 않는다.
 *
 * groo 확장(SEED 에 없다) 두 가지 — SEED 기본(top 0 · 남는 부분 없음)에서는 동작이 그대로다.
 * - keepRef: 영역 안의 이 요소부터 아래는 숨지 않는다. 숨는 거리는 영역 맨 위에서 이 요소 윗변까지다(원장 머리 — 총액 · 요약은 숨고
 *   주 달력은 남는다). 영역이 그만큼만 위로 올라가므로 남는 부분이 바로 위에 붙은 다른 고정 줄 아래에 선다.
 * - sticky top 이 0 이 아니면(위에 고정 줄이 따로 있다) 그 값만큼 일찍 붙으므로, 스크롤한 거리는 붙는 순간부터 센다.
 */

const SNAP_THRESHOLD_RATIO = 0.5;
const SCROLL_SETTLE_DELAY_MS = 120;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// 스냅 — 200ms(motion-duration-d4) · cubic-bezier(0, 0, 0.15, 1)(motion-ease-enter)
const SNAP_TRANSITION =
  "transform var(--motion-duration-d4) var(--motion-ease-enter)";

type ScrollTimelineConstructor = new (options: {
  source: Element;
  axis: "block";
}) => AnimationTimeline;

const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

function parseTranslateY(value: string) {
  if (!value || value === "none") return 0;

  const values = value.slice(value.indexOf("(") + 1, -1).split(/[ ,]+/);
  const yIndex = value.startsWith("matrix3d(")
    ? 13
    : value.startsWith("matrix(")
      ? 5
      : 1;
  const y = Number.parseFloat(values[yIndex] ?? "0");
  return Number.isFinite(y) ? y : 0;
}

function hasTransitionDuration(value: string) {
  return value.split(",").some((duration) => Number.parseFloat(duration) > 0);
}

/**
 * 숨는 영역(root)에 스크롤 상자(scrollContainerRef)를 따라 숨고 드러나는 동작을 건다.
 * ScrollAutoHide 가 쓴다 — 자식 하나를 루트로 쓰는(asChild) 쪽도 같은 훅이다.
 */
export function useScrollAutoHide(
  rootRef: React.RefObject<HTMLElement | null>,
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  keepRef?: React.RefObject<HTMLElement | null>,
) {
  React.useEffect(() => {
    const root = rootRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!root || !scrollContainer) return;

    const initialTransform = root.style.transform;
    const initialTransition = root.style.transition;
    const initialWillChange = root.style.willChange;
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const supportsScrollEnd =
      typeof scrollContainer.onscrollend !== "undefined";
    const ScrollTimeline = Reflect.get(window, "ScrollTimeline") as unknown;
    let scrollTimeline: AnimationTimeline | undefined;

    if (typeof ScrollTimeline === "function") {
      try {
        scrollTimeline = new (ScrollTimeline as ScrollTimelineConstructor)({
          source: scrollContainer,
          axis: "block",
        });
      } catch {
        scrollTimeline = undefined;
      }
    }

    const getScrollTop = () => {
      const maxScrollTop = Math.max(
        0,
        scrollContainer.scrollHeight - scrollContainer.clientHeight,
      );
      return Math.min(maxScrollTop, Math.max(0, scrollContainer.scrollTop));
    };

    let height = 0;
    let naturalOffset = 0;
    let translateY = 0;
    let previousScrollTop = getScrollTop();
    let isSettling = false;
    let isTouching = false;
    let trackingAnimation: Animation | undefined;
    let trackingDirection = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTransition = initialTransition;
    let skipNextSettleAnimation = false;

    const clamp = (value: number, min: number) =>
      Math.min(0, Math.max(min, value));

    // 스크롤한 거리보다 더 숨지 않는다 — 맨 위 근처에서는 스크롤한 만큼만
    const computeMinTranslate = (scrollTop: number) => {
      if (height === 0 || scrollTop <= naturalOffset) return 0;
      if (scrollTop >= naturalOffset + height) return -height;
      return -(scrollTop - naturalOffset);
    };

    const applyTranslate = (value: number) => {
      translateY = value;
      root.style.transform = `translate3d(0px, ${value}px, 0px)`;
    };

    const stopTracking = () => {
      trackingAnimation?.cancel();
      trackingAnimation = undefined;
      trackingDirection = 0;
    };

    const syncTracking = () => {
      if (!trackingAnimation) return;

      const renderedTranslateY = parseTranslateY(
        getComputedStyle(root).transform,
      );
      stopTracking();
      applyTranslate(
        clamp(renderedTranslateY, computeMinTranslate(getScrollTop())),
      );
    };

    // ScrollTimeline — 스크롤 방향마다 이동 구간을 브라우저에 맡긴다
    const startTracking = (direction: number, scrollTop: number) => {
      if (!scrollTimeline || direction === 0 || direction === trackingDirection)
        return;

      stopTracking();

      const maxScrollTop = Math.max(
        0,
        scrollContainer.scrollHeight - scrollContainer.clientHeight,
      );
      if (maxScrollTop === 0) return;

      let rangeStart: number;
      let rangeEnd: number;
      let rangeStartTranslate: number;
      let rangeEndTranslate: number;

      if (direction > 0) {
        rangeStart =
          translateY === 0 ? Math.max(scrollTop, naturalOffset) : scrollTop;
        rangeEnd = Math.min(maxScrollTop, rangeStart + translateY + height);
        rangeStartTranslate = translateY;
        rangeEndTranslate = translateY - (rangeEnd - rangeStart);
      } else {
        rangeEnd = scrollTop;
        rangeStart = Math.max(0, rangeEnd + translateY);
        rangeStartTranslate = Math.min(0, translateY + rangeEnd - rangeStart);
        rangeEndTranslate = translateY;
      }

      if (rangeStart === rangeEnd) {
        applyTranslate(translateY);
        return;
      }

      const startOffset = rangeStart / maxScrollTop;
      const endOffset = rangeEnd / maxScrollTop;
      const startTransform = `translate3d(0px, ${rangeStartTranslate}px, 0px)`;
      const endTransform = `translate3d(0px, ${rangeEndTranslate}px, 0px)`;

      applyTranslate(translateY);
      try {
        trackingAnimation = root.animate(
          [
            { transform: startTransform, offset: 0 },
            { transform: startTransform, offset: startOffset },
            { transform: endTransform, offset: endOffset },
            { transform: endTransform, offset: 1 },
          ],
          { fill: "both", timeline: scrollTimeline },
        );
      } catch {
        scrollTimeline = undefined;
        applyTranslate(translateY);
        return;
      }
      trackingDirection = direction;
    };

    const clearSettleTimer = () => {
      if (settleTimer === undefined) return;
      clearTimeout(settleTimer);
      settleTimer = undefined;
    };

    const finishSettling = () => {
      if (isSettling) {
        isSettling = false;
        root.style.transition = settleTransition;
      }
      root.style.willChange = initialWillChange;
    };

    const cancelSettling = () => {
      if (!isSettling) return;
      const renderedTranslateY = parseTranslateY(
        getComputedStyle(root).transform,
      );
      finishSettling();
      applyTranslate(
        clamp(renderedTranslateY, computeMinTranslate(getScrollTop())),
      );
    };

    // 스크롤이 끝남 — 50% 를 기준으로 다 숨거나 다 드러난다
    const settle = () => {
      clearSettleTimer();
      syncTracking();
      if (height === 0) return;

      if (mediaQuery.matches) {
        finishSettling();
        root.style.transition = initialTransition;
        applyTranslate(0);
        skipNextSettleAnimation = false;
        return;
      }

      const visibleRatio = 1 + translateY / height;
      const minTranslate = computeMinTranslate(getScrollTop());
      const target =
        visibleRatio >= SNAP_THRESHOLD_RATIO ? 0 : clamp(-height, minTranslate);

      if (target === translateY) {
        finishSettling();
        skipNextSettleAnimation = false;
        return;
      }

      // 키보드로 스크롤한 뒤에는 움직임 없이 바로
      if (skipNextSettleAnimation) {
        finishSettling();
        root.style.transition = initialTransition;
        applyTranslate(target);
        skipNextSettleAnimation = false;
        return;
      }

      if (!isSettling) settleTransition = root.style.transition;
      const computedStyle = getComputedStyle(root);
      const computedTransition = computedStyle.transition;

      isSettling = true;
      root.style.willChange = "transform";
      root.style.transition = hasTransitionDuration(
        computedStyle.transitionDuration,
      )
        ? `${computedTransition}, ${SNAP_TRANSITION}`
        : SNAP_TRANSITION;
      applyTranslate(target);
    };

    const scheduleSettle = () => {
      if (supportsScrollEnd || isTouching) return;
      clearSettleTimer();
      settleTimer = setTimeout(settle, SCROLL_SETTLE_DELAY_MS);
    };

    // 영역의 높이 · 스크롤 상자 안 제자리를 잰다 — sticky · transform 을 잠시 걷고
    const measure = () => {
      syncTracking();
      cancelSettling();

      const previousPosition = root.style.position;
      const previousTransition = root.style.transition;
      const previousTransform = root.style.transform;
      const visibleRatio = height === 0 ? 1 : 1 + translateY / height;

      root.style.position = "relative";
      root.style.transition = "none";
      root.style.transform = "none";

      const rootRect = root.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();
      const scrollTop = getScrollTop();
      // sticky top — relative 로 잴 때 그만큼 밀려 있고, 그만큼 일찍 붙는다(auto · 0 이면 SEED 그대로)
      const stickyTop = Number.parseFloat(getComputedStyle(root).top) || 0;
      const keep = keepRef?.current;
      height =
        keep && root.contains(keep)
          ? Math.max(0, keep.getBoundingClientRect().top - rootRect.top)
          : rootRect.height;
      naturalOffset =
        scrollTop +
        rootRect.top -
        stickyTop -
        scrollRect.top -
        scrollContainer.clientTop -
        stickyTop;

      root.style.position = previousPosition;
      root.style.transition = previousTransition;
      root.style.transform = previousTransform;

      const nextTranslate = height === 0 ? 0 : -(1 - visibleRatio) * height;
      applyTranslate(clamp(nextTranslate, computeMinTranslate(scrollTop)));
    };

    // 스크롤하는 동안 — 거리를 1:1 로 따라간다
    const handleScroll = () => {
      clearSettleTimer();
      cancelSettling();

      const scrollTop = getScrollTop();
      const scrollDelta = scrollTop - previousScrollTop;
      previousScrollTop = scrollTop;

      if (mediaQuery.matches) {
        stopTracking();
        finishSettling();
        applyTranslate(0);
        return;
      }

      root.style.willChange = "transform";
      translateY = clamp(
        translateY - scrollDelta,
        computeMinTranslate(scrollTop),
      );

      if (scrollTimeline && !skipNextSettleAnimation) {
        startTracking(Math.sign(scrollDelta), scrollTop);
      } else {
        stopTracking();
        applyTranslate(translateY);
      }
      scheduleSettle();
    };

    const handleInteractionStart = () => {
      clearSettleTimer();
      cancelSettling();
      syncTracking();
      skipNextSettleAnimation = false;
    };

    const handleTouchStart = () => {
      isTouching = true;
      handleInteractionStart();
    };

    const handleTouchEnd = () => {
      isTouching = false;
      if (!supportsScrollEnd) scheduleSettle();
    };

    // 숨은 영역 안으로 초점이 오면 바로 다 드러낸다. 남는 부분(keepRef)은 늘 보이므로 그 안의 초점은 드러낼 일이 아니다 — 드러내면
    // 누르는 사이(mousedown 초점 → mouseup) 남는 부분이 숨는 높이만큼 내려가 누른 칸에서 손이 벗어난다
    const handleFocusIn = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        keepRef?.current?.contains(event.target)
      )
        return;
      clearSettleTimer();
      cancelSettling();
      stopTracking();
      previousScrollTop = getScrollTop();
      root.style.transition = initialTransition;
      root.style.willChange = initialWillChange;
      applyTranslate(0);
    };

    // 키보드 스크롤 — 끝나면 움직임 없이 바로 스냅한다(칸 안의 글자 입력은 빼고)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return;
      if (
        !(event.target instanceof Node) ||
        !scrollContainer.contains(event.target)
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
      ) {
        return;
      }
      skipNextSettleAnimation = true;
      cancelSettling();
      syncTracking();
    };

    const handleTransitionComplete = (event: TransitionEvent) => {
      if (event.target !== root || event.propertyName !== "transform") return;
      finishSettling();
    };

    // 모션 줄이기를 켜고 끄면 — 켜면 늘 보이고, 끄면 다시 잰다
    const handleReducedMotionChange = () => {
      clearSettleTimer();
      cancelSettling();
      stopTracking();
      finishSettling();
      root.style.transition = initialTransition;
      applyTranslate(0);
      previousScrollTop = getScrollTop();
      skipNextSettleAnimation = false;

      if (!mediaQuery.matches) measure();
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    resizeObserver.observe(scrollContainer);
    if (keepRef?.current) resizeObserver.observe(keepRef.current);

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    scrollContainer.addEventListener("scrollend", settle);
    scrollContainer.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    scrollContainer.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });
    scrollContainer.addEventListener("touchcancel", handleTouchEnd, {
      passive: true,
    });
    scrollContainer.addEventListener("wheel", handleInteractionStart, {
      passive: true,
    });
    root.addEventListener("focusin", handleFocusIn);
    root.addEventListener("transitionend", handleTransitionComplete);
    root.ownerDocument.addEventListener("keydown", handleKeyDown);
    mediaQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      clearSettleTimer();
      stopTracking();
      resizeObserver.disconnect();
      scrollContainer.removeEventListener("scroll", handleScroll);
      scrollContainer.removeEventListener("scrollend", settle);
      scrollContainer.removeEventListener("touchstart", handleTouchStart);
      scrollContainer.removeEventListener("touchend", handleTouchEnd);
      scrollContainer.removeEventListener("touchcancel", handleTouchEnd);
      scrollContainer.removeEventListener("wheel", handleInteractionStart);
      root.removeEventListener("focusin", handleFocusIn);
      root.removeEventListener("transitionend", handleTransitionComplete);
      root.ownerDocument.removeEventListener("keydown", handleKeyDown);
      mediaQuery.removeEventListener("change", handleReducedMotionChange);
      root.style.transform = initialTransform;
      root.style.transition = initialTransition;
      root.style.willChange = initialWillChange;
    };
  }, [rootRef, scrollContainerRef, keepRef]);
}
