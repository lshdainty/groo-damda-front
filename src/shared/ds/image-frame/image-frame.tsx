import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { aspectRatioVariants } from "@/shared/ds/aspect-ratio";
import { ContentPlaceholder } from "@/shared/ds/content-placeholder";
import { LOADING_TIMING, Skeleton } from "@/shared/ds/skeleton";

import {
  IMAGE_LOADING,
  IMAGE_REVEAL,
  ImageFrameHoldLoading,
  imageFrameFloaterVariants,
  imageFrameImageVariants,
  imageFrameIndicatorVariants,
  imageFrameRadius,
  imageFrameVariants,
  pickFloaters,
  type ImageFrameFit,
  type ImageFramePlacement,
  type ImageFrameRatio,
} from "./image-frame-variants";

/*
 * Groo Image Frame — 구조는 SEED Image Frame(2026-10-04). 수치 원본은 groo-design specs/components/image-frame.yaml(틀) ·
 * card-art.yaml(카드 그림 · 카드 면)(값은 src/shared/ds/spec/image-frame.json · card-art.json), 카드 면의 색은 institution-colors.yaml
 * (src/shared/ds/institution-colors). groo-design recipes/shadcn/components/ui/image-frame.tsx 를 첫 판으로 가져왔다.
 * 옛 Aspect Ratio + 화면마다 손으로 짠 그림 틀을 대신한다. 카드 그림(CardArt)은 같은 폴더의 card-art.tsx 다.
 *
 *   ImageFrame           그림 한 장을 보이는 틀 — 비율 상자에 그림을 꽉 채우고(cover) 그림 위에 안쪽 1px 투명 윤곽을 늘 그린다.
 *                        불러오는 동안은 같은 모서리의 Skeleton, 없거나 · 못 불러오거나 · 10초가 지나도 안 오면 대체 그림(Content Placeholder)
 *     src                그림 — 없으면(undefined · null · "") 처음부터 대체 그림
 *     alt                필수 — 이름 옆 그림 · 장식 그림은 "", 혼자인 그림은 무엇인지. 대체 그림이 이 글을 이름으로 이어받는다
 *     ratio              "1:1" · "2:1" · "16:9" · "4:3"(기본) · "6:7" · "4:5" · "2:3" · "card"(1.586 — 세로 그림은 돌린다). Aspect Ratio 와 같은 여덟
 *     width              고정 폭(px — 목록 · 썸네일) — 모서리를 고른다. 없으면 부모 폭을 채우고 모서리 8
 *     bleed              화면 폭 — 좌우가 화면 끝에 닿는 그림, 모서리 0(윤곽은 그대로)
 *     fit                "cover"(기본 — 사진 · 카드 그림, 가운데를 남겨 자른다) · "contain"(로고 · 글이 든 그림 — 잘리지 않게, 둘레는 흰 판)
 *     fallbackIcon       대체 그림 아이콘 — 기본 ImageIcon(Content Placeholder)
 *     fallback           대체 그림을 통째로 바꿀 때(CardArt 가 카드 면을 넣는다)
 *     loading            "lazy"(기본 — 화면에 들어올 때 받는다) · "eager"(첫 화면의 큰 그림)
 *     srcSet · sizes     img 그대로
 *     children           ImageFrameFloater 둘까지. 그 밖은 바깥 div 속성
 *   ImageFrameFloater    그림 위 자리 — placement(필수) "top-start" · "top-end" · "bottom-start" · "bottom-end", 틀 가장자리에서 6
 *   ImageFrameIndicator  장수 · 길이 글 — 보이는 글(children — "1 / 12" · "+9")과 읽는 글(label, 필수 — "사진 12장 중 1번째")
 *   imageFrameRadius     폭 → 모서리 "4" · "6" · "8" — 틀 밖에서 같은 모서리가 필요할 때(Skeleton 의 radius). image-frame-variants.ts
 *
 * 틀 — 폭은 부르는 쪽, 높이는 폭 ÷ 비율(CSS aspect-ratio)이라 그림이 오기 전에 자리를 잡는다. 모서리로 그림 · 스켈레톤 · 대체 그림을
 *   자르고(overflow hidden) 안의 층을 따로 쌓는다(isolation). 부모보다 넓어지지 않는다(max-width 100%). 틀이 크기 컨테이너
 *   (container image-frame)라 카드 면의 크기 · 그림 위 자리가 틀의 폭 · 높이로 갈린다.
 * 모서리 — 폭으로 고른다(SEED): 24 이하 4(radius-r1) · 48 이하 6(radius-r1_5) · 그 위 8(radius-r2) · 화면 폭 0. 작은 그림일수록
 *   줄인다(24 에 8 이면 알약처럼 보인다). 불러오는 동안 · 대체 그림도 같은 모서리다(틀이 자른다).
 * 윤곽 — 안쪽 1px stroke-neutral-overlay(v118 — 검정 4.7% · 다크 흰 5%), ::after 로 그림 · 스켈레톤 · 대체 그림 · 카드 면 위에 늘
 *   그린다(inset box-shadow — 크기가 변하지 않고 누르기를 막지 않는다). 끄는 속성이 없다.
 * 그림 — 틀을 채운다(cover). contain 이면 잘리지 않게 넣고 둘레는 흰 판(static-white — 두 모드 같다).
 *   ratio card 에서 그림의 원래 폭이 높이보다 작으면(세로 카드) 시계 방향으로 90° 돌린다. 방향은 다 받은 뒤 원래 크기로 정하고,
 *   그때까지는 스켈레톤이다(돌기 전 모습이 보이지 않는다). 가로 · 정사각 그림은 그대로다.
 * 상태 — loading · loaded · fallback(data-state)
 *   loading   스켈레톤(면 + 반짝임). 그림은 받는 동안 투명도 0
 *   loaded    스켈레톤을 걷고 그림이 투명도로 나타난다(150ms, 모션 줄이기면 바로). 붙을 때 이미 다 받아 둔 그림은 그대로 보인다 —
 *             스켈레톤이 보인 적이 없다
 *   fallback  그림이 없음 · 못 불러옴 · 10초(LOADING_TIMING.timeout)가 지나도 안 옴 — 대체 그림. img 를 걷어 깨진 그림 아이콘 · alt 글이
 *             보이지 않는다. 10초는 틀이 화면에 들어온 때부터 잰다 — lazy 그림은 그때 받기 시작하므로 붙은 때부터 재면 아래쪽 그림이
 *             보기도 전에 실패로 바뀐다. 실패로 바뀐 뒤에는 그림이 와도 다시 바꾸지 않는다
 * 그림 위 요소 — 네 모서리에 하나씩, 틀 하나에 둘까지(셋째 · 같은 자리의 둘째는 그리지 않고 개발 중에 알린다). 틀의 짧은 변이 80 이상일
 *   때만 보인다(container query). 누르지 않는다(pointer-events none — 누르는 자리는 감싼 버튼 · 링크).
 * 이름 — 틀은 역할이 없다. 그림은 <img alt>, 스켈레톤은 aria-hidden. 대체 그림은 alt 가 있으면 role="img" + 그 이름, "" 면 숨긴다.
 * 누르지 않는다 · 마우스에 키우지 않는다. 상태는 흐리지 않고 배지로 알린다.
 */

type ImageStatus = "loading" | "loaded" | "error";
type ImageState = {
  src?: string;
  status: ImageStatus;
  portrait: boolean;
  reveal: boolean;
};

const loadingState = (src: string | undefined): ImageState => ({
  src,
  status: "loading",
  portrait: false,
  reveal: false,
});

// 받는 중일 때만 바꾼다 — 실패 뒤에 온 그림 · 같은 그림의 두 번째 알림은 무시한다. src 가 바뀌었으면 다시 loading 에서 시작
function settled(
  prev: ImageState,
  src: string | undefined,
  img: HTMLImageElement,
  reveal: boolean,
): ImageState {
  const base = prev.src === src ? prev : loadingState(src);
  if (base.status !== "loading") return base;
  return {
    src,
    status: "loaded",
    portrait: img.naturalWidth < img.naturalHeight,
    reveal,
  };
}

function failed(prev: ImageState, src: string | undefined): ImageState {
  const base = prev.src === src ? prev : loadingState(src);
  return base.status === "loading" ? { ...base, status: "error" } : base;
}

// 그림 상태 — 붙기 전에 이미 끝난 그림(받아 둔 것)은 붙자마자 complete 로 읽고 그대로 보인다(reveal 없이). 크기가 없는 그림(SVG)도
// 0 으로 읽히므로 0 이면 decode 로 가른다. 붙을 때 부르는 함수(attach)는 처음 만든 것을 계속 쓴다 — 그리기마다 새 함수면 React 가
// 그때마다 떼고 다시 붙여 부르고, 끝난 그림이 상태를 또 바꿔 다시 그리는 고리가 된다(컴파일러가 없는 테스트에서). 어느 그림인지는
// 요소의 src 로 읽는다.
// 10초 — 틀이 화면에 들어온 때부터 잰다. 지나면 실패와 같다(hold 면 재지 않는다)
function useFrameImage(
  src: string | undefined,
  frame: React.RefObject<HTMLDivElement | null>,
  hold: boolean,
) {
  const [state, setState] = React.useState<ImageState>(() => loadingState(src));
  const current = state.src === src ? state : loadingState(src);
  const [attach] = React.useState(() => (img: HTMLImageElement | null) => {
    if (!img?.complete) return;
    const shown = img.getAttribute("src") ?? undefined;
    if (img.naturalWidth > 0) {
      setState((prev) => settled(prev, shown, img, false));
      return;
    }
    img.decode().then(
      () => setState((prev) => settled(prev, shown, img, false)),
      () => setState((prev) => failed(prev, shown)),
    );
  });
  const status = current.status;
  React.useEffect(() => {
    if (!src || status !== "loading" || hold) return;
    let timer: number | undefined;
    const start = () => {
      if (timer === undefined)
        timer = window.setTimeout(
          () => setState((prev) => failed(prev, src)),
          LOADING_TIMING.timeout,
        );
    };
    const el = frame.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [src, status, hold, frame]);
  return {
    ...current,
    attach,
    loaded: (img: HTMLImageElement) =>
      setState((prev) => settled(prev, src, img, true)),
    failed: () => setState((prev) => failed(prev, src)),
  };
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[ImageFrame] ${message}`);
}

export interface ImageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 그림 — 없으면(undefined · null · "") 처음부터 대체 그림 */
  src?: string | null;
  /** 필수 — 이름 옆 · 장식 그림은 "", 혼자인 그림은 무엇인지. 대체 그림이 이름으로 이어받는다 */
  alt: string;
  /** 비율 — 기본 "4:3". "card"(1.586)는 세로 그림을 시계 방향으로 90° 돌린다 */
  ratio?: ImageFrameRatio;
  /** 고정 폭(px) — 모서리를 고른다(24 이하 4 · 48 이하 6 · 그 위 8). 없으면 부모 폭을 채우고 모서리 8 */
  width?: number;
  /** 화면 폭 — 좌우가 화면 끝에 닿는 그림, 모서리 0 */
  bleed?: boolean;
  /** "cover"(기본) · "contain"(잘리지 않게 — 둘레는 흰 판) */
  fit?: ImageFrameFit;
  /** 대체 그림 아이콘 — 기본 ImageIcon */
  fallbackIcon?: React.ReactNode;
  /** 대체 그림을 통째로 바꿀 때(카드 면). 틀을 채운다 */
  fallback?: React.ReactNode;
  /** "lazy"(기본) · "eager"(첫 화면의 큰 그림) */
  loading?: "lazy" | "eager";
  srcSet?: string;
  sizes?: string;
}

const ImageFrame = React.forwardRef<HTMLDivElement, ImageFrameProps>(
  (
    {
      src,
      alt,
      ratio = "4:3",
      width,
      bleed = false,
      fit = "cover",
      fallbackIcon,
      fallback,
      loading = "lazy",
      srcSet,
      sizes,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const frameRef = React.useRef<HTMLDivElement | null>(null);
    const hold = React.useContext(ImageFrameHoldLoading);
    const source = src != null && src !== "" ? src : undefined;
    const frame = useFrameImage(source, frameRef, hold);
    const { attach, loaded, failed, portrait, reveal } = frame;
    const status: ImageStatus = !source
      ? "error"
      : hold
        ? "loading"
        : frame.status;
    const state = status === "error" ? "fallback" : status;
    const radius = bleed ? "0" : imageFrameRadius(width);
    const rotate = ratio === "card" && status === "loaded" && portrait;
    const named = alt.trim() !== "";
    const { floaters, dropped } = pickFloaters(children);

    // 개발 중 — 셋째 · 같은 자리의 둘째 요소, 짧은 변이 80 보다 작은 틀의 요소
    React.useEffect(() => {
      if (!import.meta.env.DEV) return;
      if (dropped > 0)
        warnOnce(
          "drop",
          `그림 위 요소는 네 모서리에 하나씩, 틀 하나에 둘까지다 — ${dropped}개를 그리지 않았다.`,
        );
      const el = frameRef.current;
      if (!el || floaters.length === 0) return;
      const box = el.getBoundingClientRect();
      const short = Math.min(box.width, box.height);
      if (box.width > 0 && short < 80)
        warnOnce(
          "small",
          `틀의 짧은 변이 80 보다 작다(${Math.round(short)}) — 그림 위 요소를 그리지 않는다. 배지 · 장수는 줄의 글로 둔다.`,
        );
    }, [dropped, floaters.length]);

    return (
      <div
        ref={mergeRefs(ref, frameRef)}
        data-slot="image-frame"
        data-state={state}
        data-ratio={ratio}
        data-radius={radius}
        data-fit={fit}
        data-rotated={rotate || undefined}
        className={cn(
          imageFrameVariants({ radius }),
          aspectRatioVariants({ ratio }),
          width != null ? "shrink-0" : "w-full",
          className,
        )}
        style={width != null ? { width, ...style } : style}
        {...props}
      >
        {source && status === "loading" && (
          <Skeleton
            radius="0"
            wait="none"
            className="absolute inset-0 size-full"
          />
        )}
        {source && status !== "error" && (
          <img
            key={source}
            ref={attach}
            data-slot="image-frame-image"
            loading={loading}
            sizes={sizes}
            srcSet={srcSet}
            alt={alt}
            src={source}
            className={cn(
              imageFrameImageVariants({ rotate, fit }),
              status === "loading" && IMAGE_LOADING,
              status === "loaded" && reveal && IMAGE_REVEAL,
            )}
            onLoad={(e) => loaded(e.currentTarget)}
            onError={failed}
          />
        )}
        {status === "error" && (
          <div
            data-slot="image-frame-fallback"
            className="absolute inset-0 flex"
            {...(named
              ? { role: "img", "aria-label": alt }
              : { "aria-hidden": true })}
          >
            {fallback ?? <ContentPlaceholder icon={fallbackIcon} />}
          </div>
        )}
        {floaters}
      </div>
    );
  },
);
ImageFrame.displayName = "ImageFrame";

// ── 그림 위 자리 ─────────────────────────────────────────────

export interface ImageFrameFloaterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 자리(필수) — 위 시작 · 위 끝 · 아래 시작 · 아래 끝 */
  placement: ImageFramePlacement;
  /** 하나 — Badge variant="solid"(상태 · 분류) 또는 ImageFrameIndicator(장수 · 길이) */
  children: React.ReactNode;
}

const ImageFrameFloater = React.forwardRef<
  HTMLDivElement,
  ImageFrameFloaterProps
>(({ placement, className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="image-frame-floater"
    data-placement={placement}
    className={cn(imageFrameFloaterVariants({ placement }), className)}
    {...props}
  />
));
ImageFrameFloater.displayName = "ImageFrameFloater";

// ── Indicator ───────────────────────────────────────────────

export interface ImageFrameIndicatorProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  /** 보이는 글 — "1 / 12"(지금 장 / 전체) · "+9"(나머지 장수). 보조 기술에는 숨긴다 */
  children: React.ReactNode;
  /** 읽는 글(필수) — 무엇의 수인지. "사진 12장 중 1번째" · "사진 9장 더 있음" */
  label: string;
}

const ImageFrameIndicator = React.forwardRef<
  HTMLSpanElement,
  ImageFrameIndicatorProps
>(({ label, className, children, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="image-frame-indicator"
    className={cn(imageFrameIndicatorVariants(), className)}
    {...props}
  >
    <span aria-hidden="true">{children}</span>
    <span className="sr-only">{label}</span>
  </span>
));
ImageFrameIndicator.displayName = "ImageFrameIndicator";

export { ImageFrame, ImageFrameFloater, ImageFrameIndicator };
