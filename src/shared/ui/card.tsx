import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";

/*
 * Groo Card — groo-design specs/components/card.md SoT 기반.
 * v5: variant 도입 — shadow (default) / bordered. v6: muted / brand 공식화.
 *
 * - Card: rounded-r3 + variant 별 bg + (shadow variant) inline boxShadow.
 *   inline boxShadow는 Tailwind v4 utility 내부 분해(--tw-shadow-*) 문제로
 *   다크모드 토큰 override 우회되는 이슈 fix (spec migration note).
 *   Card 자체는 padding 없음 — sub-component가 padding 보유 (shadcn 정석 패턴).
 * - variant=shadow (default): border 없음 + shadow-s1. 일반 정보 카드 (preview .review-* SoT).
 * - variant=bordered (v5): 1px border-subtle + shadow 없음. dense info / inline summary
 *   (선택 기간 hint, chart 내 sub-card). App PCard.bordered 와 정합.
 * - variant=muted (v6): bg-muted 채움 + border/shadow 없음. dark dialog 위에서 bordered 가
 *   surface 와 묻혀 안 보이던 inline summary(가계부 day-detail 합계 카드)용.
 *   App PCard.muted 정합.
 * - variant=brand (v6): bg-brand-subtle + 1px border-brand + shadow 없음. 브랜드 틴트 강조
 *   ('현재 플랜' 배너, selected/active). App PCard.brand 정합. 보더는 사용처에서
 *   border-brand-soft 로 override 가능(은은한 강조).
 * - CardHeader: flex flex-col gap-x1 p-x4 md:p-x6.
 * - CardContent: p-x4 md:p-x6, CardHeader/CardFooter 다음에 올 땐 pt-0.
 * - CardFooter: flex items-center p-x4 md:p-x6 pt-0.
 */

const cardVariants = cva(
  "rounded-[var(--radius-r3)] text-fg-neutral transition-[background-color,box-shadow] duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
  {
    variants: {
      variant: {
        shadow: "bg-bg-layer-default border border-stroke-neutral-weak",
        bordered: "bg-bg-layer-default border border-border-subtle",
        muted: "bg-[var(--bg-muted)]",
        brand:
          "bg-[var(--bg-brand-subtle)] border border-[var(--border-brand)]",
        // v7 raised: 모바일 카드 다이어트의 keep(강조 요약/히어로) 카드 — 페이지 배경이
        // surface 로 올라와 일반 카드는 플랫으로 벗겨지고, 유지가 필요한 요약만
        // surface-raised(다크 #2d3346 패널 / 라이트 흰 카드) + shadow-s3 로 확실히 띄운다.
        // (design app.css `.m-scroll .p-card--keep` SoT — groo-design card.md 미러 필요)
        raised:
          "bg-[var(--bg-surface-raised)] border border-stroke-neutral-weak",
      },
    },
    defaultVariants: {
      variant: "shadow",
    },
  },
);

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, style, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ variant }), className)}
    style={style}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "flex flex-col gap-[var(--spacing-x1)] p-[var(--spacing-x4)] md:p-[var(--spacing-x6)]",
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-t6 font-semibold leading-none tracking-tight text-fg-neutral",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-t4 text-fg-neutral-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  // first-child일 땐 full p-x6(standalone 카드), CardHeader 다음일 땐 pt-0(헤더 자연 연결).
  <div
    ref={ref}
    className={cn(
      "p-[var(--spacing-x4)] md:p-[var(--spacing-x6)] [&:not(:first-child)]:pt-0",
      className,
    )}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  // first-child일 땐 full p-x6, content/header 다음일 땐 pt-0(자연 연결).
  <div
    ref={ref}
    className={cn(
      "flex items-center p-[var(--spacing-x4)] md:p-[var(--spacing-x6)] [&:not(:first-child)]:pt-0",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
