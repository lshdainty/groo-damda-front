import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";
import type { AspectRatioValue } from "@/shared/ds/aspect-ratio";
import type { InstitutionText } from "@/shared/ds/institution-colors";

/*
 * Groo Image Frame · Card Art 의 모양 규칙 — 틀 · 그림 · 그림 위 자리 · Indicator · 카드 면의 클래스와 모서리 규칙.
 * 컴포넌트는 image-frame.tsx · card-art.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 * 값의 출처는 groo-design specs/components/image-frame.yaml · card-art.yaml(src/shared/ds/spec/image-frame.json · card-art.json).
 * 윤곽 · 모서리 규칙은 Logo Tile(카드 그림 판)도 그대로 쓴다.
 */

export type ImageFrameRatio = AspectRatioValue;
export type ImageFrameRadius = "4" | "6" | "8";
export type ImageFrameFit = "cover" | "contain";
export type ImageFramePlacement =
  "top-start" | "top-end" | "bottom-start" | "bottom-end";

/** 그림 위 요소 — 틀 하나에 둘까지 */
export const MAX_FLOATERS = 2;

/** 폭 → 모서리(SEED) — 24 이하 "4" · 48 이하 "6" · 그 위 "8". 폭을 모르면(부모 폭을 채운다) "8" */
export function imageFrameRadius(width?: number | null): ImageFrameRadius {
  if (width == null || Number.isNaN(width)) return "8";
  return width <= 24 ? "4" : width <= 48 ? "6" : "8";
}

// 틀 — 비율 상자 · 모서리로 자르기 · 층 따로 쌓기 · 크기 컨테이너. ::after 가 안쪽 1px 투명 윤곽(그림 · 스켈레톤 · 대체 그림 위).
// 윤곽의 두께 · 색은 틀의 변수가 정하고 ::after 의 그림자가 그린다 — 검사기(npm run ds:check)는 그림자를 읽지 못해 그 변수를 잰다
export const imageFrameVariants = cva(
  [
    "relative isolate block max-w-full overflow-hidden [container-name:image-frame] [container-type:size]",
    "[--image-frame-border-width:1px] [--image-frame-border-color:var(--color-stroke-neutral-overlay)]",
    "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:[box-shadow:inset_0_0_0_var(--image-frame-border-width)_var(--image-frame-border-color)] after:content-['']",
  ].join(" "),
  {
    variants: {
      radius: {
        "0": "rounded-none",
        "4": "rounded-r1",
        "6": "rounded-r1_5",
        "8": "rounded-r2",
      },
    },
    defaultVariants: { radius: "8" },
  },
);

// 그림 — 틀을 채운다. rotate 는 카드 비율(1.586)의 틀에서만 쓴다 — 그림 상자를 틀의 높이 × 폭(100% ÷ 1.586 × 158.6%)으로 잡아
// 가운데에 두고 시계 방향으로 90° 돌린다. contain 은 둘레를 흰 판(그림의 바탕, 두 모드 같다)으로 채운다
export const imageFrameImageVariants = cva("absolute block", {
  variants: {
    rotate: {
      false: "inset-0 size-full",
      true: "left-1/2 top-1/2 h-[158.6%] w-[calc(100%/1.586)] -translate-x-1/2 -translate-y-1/2 rotate-90",
    },
    fit: {
      cover: "object-cover",
      contain: "bg-static-white object-contain",
    },
  },
  defaultVariants: { rotate: false, fit: "cover" },
});

// 받는 동안은 보이지 않게 · 다 받으면 투명도로(150ms, 모션 줄이기면 바로)
export const IMAGE_LOADING = "opacity-0";
export const IMAGE_REVEAL =
  "animate-[fade-in_var(--motion-duration-d3)_var(--motion-ease-enter)] motion-reduce:animate-none";

// 그림 위 자리 — 네 모서리, 틀 가장자리 → 요소 바깥 상자 6. 틀의 짧은 변이 80 이상일 때만 보인다. 누르지 않는다
export const imageFrameFloaterVariants = cva(
  "pointer-events-none absolute hidden [@container_image-frame_(min-width:80px)_and_(min-height:80px)]:flex",
  {
    variants: {
      placement: {
        "top-start": "start-x1_5 top-x1_5",
        "top-end": "end-x1_5 top-x1_5",
        "bottom-start": "bottom-x1_5 start-x1_5",
        "bottom-end": "bottom-x1_5 end-x1_5",
      } satisfies Record<ImageFramePlacement, string>,
    },
  },
);

// Indicator — 알약 · 검정 65%(두 모드 같다) · 흰 11/15 500 · 좌우 6 · 위아래 2 · 높이 19. 사진 위 표식이라 글자 크기 설정을 따르지 않는다
// (text-t1-static — image-frame.yaml indicator) — 글자가 그대로라 높이도 19 그대로다
export const imageFrameIndicatorVariants = cva(
  "inline-flex min-h-[19px] items-center whitespace-nowrap rounded-full bg-[var(--overlay-dim-dark)] px-x1_5 py-x0_5 font-sans text-t1-static font-medium text-static-white",
);

/** 카탈로그 · 테스트 전용 — 받는 중 상태를 붙잡아 둔다(실제로는 그림이 오면 곧 바뀌어 견본으로 잴 수 없다). 화면에서 쓰지 않는다 */
export const ImageFrameHoldLoading = React.createContext(false);

/** 그림 위 요소를 자리마다 하나 · 둘까지(앞에서부터) 거른다. 걸러 낸 수는 개발 중 알린다 */
export function pickFloaters(children: React.ReactNode) {
  const all = React.Children.toArray(children).filter(React.isValidElement);
  const floaters: React.ReactElement[] = [];
  const taken = new Set<unknown>();
  for (const child of all) {
    const placement = (child.props as { placement?: unknown }).placement;
    if (
      floaters.length === MAX_FLOATERS ||
      (placement != null && taken.has(placement))
    )
      continue;
    taken.add(placement);
    floaters.push(child);
  }
  return { floaters, dropped: all.length - floaters.length };
}

// ── 카드 면(그림 없는 아는 카드사) ───────────────────────────
// 기관 색 한 색 + 표의 글자색. 크기는 틀의 폭으로(container image-frame): 96 미만 첫 글자 · 96 ~ 239 medium · 240 이상 large.
// 회사 · 카드 이름은 카드 그림 안 글이라 글자 크기 설정을 따르지 않는다(-static — card-art.yaml, groo-design #264). 글이 커지지 않아
// 폭 96 이상 면에는 늘 들어가므로, 면 모양은 폭으로만 가른다
export const CARD_FACE_TEXT: Record<InstitutionText, string> = {
  white: "text-static-white",
  dark: "text-fg-neutral dark:text-fg-neutral-inverted",
};
export const CARD_FACE = "relative size-full overflow-hidden font-sans";
// 첫 글자 — 회사 첫 글자 가운데, 면 높이의 40%(정수로 · 가장 작아도 10) · 700 · 줄 높이 1 · 로마자 대문자. 글 칸이 보이면 숨긴다.
// 줄 높이는 글자 크기 뒤에 붙인다 — tailwind-merge 는 뒤에 오는 글자 크기가 줄 높이를 지운다고 본다
export const CARD_FACE_INITIAL = cn(
  "absolute inset-0 flex items-center justify-center font-bold uppercase @min-[96px]/image-frame:hidden",
  "text-[length:max(10px,round(40cqh,1px))]",
  "leading-none",
);
// medium · large — 왼쪽 아래 회사 · 카드 이름(폭 96 이상)
export const CARD_FACE_LABEL =
  "absolute inset-x-0 bottom-0 hidden flex-col px-x2_5 pb-x2 @min-[96px]/image-frame:flex @min-[240px]/image-frame:px-x4 @min-[240px]/image-frame:pb-x3_5";
export const CARD_FACE_ISSUER =
  "truncate text-t2-static font-medium @min-[240px]/image-frame:text-t3-static";
export const CARD_FACE_NAME =
  "line-clamp-1 break-keep text-t4-static font-bold [overflow-wrap:break-word] @min-[240px]/image-frame:line-clamp-2 @min-[240px]/image-frame:text-t5-static";
