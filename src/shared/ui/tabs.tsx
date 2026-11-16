import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib";

/*
 * Groo Tabs — groo-design specs/components/tabs.md SoT 기반.
 * Phase 2 마이그레이션: groo 토큰 + desk-front variants(pill/underline) 보존.
 *
 * 2 variants:
 *   pill (default): bg-bg-neutral-weak 컨테이너 + active bg-bg-layer-default + shadow-s1.
 *                   = tabs.md container variant. 설정/form section·보조 컨트롤.
 *   underline: bottom border + active 2px primary 색. 절제 톤 페이지 네비게이션.
 *
 * size (pill 전용 — tabs.md Container size variant):
 *   default: list h-10(40) / trigger min-h-8(32) · 4×12 · label-md(14)
 *   sm:      list h-8(32)  / trigger min-h-7(28) · 4×8  · label-sm(13)  ← 데스크 보조 컨트롤
 *   size 는 TabsList 에서 받아 context 로 TabsTrigger 에 전파.
 *
 * - Radix Tabs 베이스. 키보드 네비/ARIA 자동.
 */

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva("", {
  variants: {
    variant: {
      pill: "inline-flex items-center justify-center rounded-r1 bg-bg-neutral-weak gap-1 text-fg-neutral-muted",
      underline:
        "flex gap-0 border-b border-stroke-neutral-weak bg-transparent p-0 h-auto rounded-none",
      // tabs.md pills variant — 트랙 없는 평면 배치(카테고리 필터·거래 종류 등 모바일 nav)
      pills: "inline-flex items-center gap-[var(--spacing-x1)] bg-transparent",
    },
    size: { default: "", sm: "" },
  },
  compoundVariants: [
    { variant: "pill", size: "default", class: "h-10 p-[var(--spacing-x1)]" },
    { variant: "pill", size: "sm", class: "h-8 p-0.5" },
  ],
  defaultVariants: { variant: "pill", size: "default" },
});

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-sans font-medium transition-all duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring disabled:pointer-events-none disabled:text-fg-disabled",
  {
    variants: {
      variant: {
        pill: "rounded-r0_5 data-[state=active]:bg-bg-layer-default data-[state=active]:text-fg-neutral data-[state=active]:shadow-s1",
        underline:
          "rounded-none px-3.5 py-2.5 text-[13px] text-fg-neutral-muted border-b-2 border-transparent -mb-px hover:text-fg-neutral data-[state=active]:text-[var(--fg-brand)] data-[state=active]:border-[var(--border-brand)] data-[state=active]:font-semibold",
        // tabs.md pills — soft rectangle radius-md + active primary fill + on-accent 흰색.
        // active fill = bg-brand(=primary, 다크에서도 고정. 앱 t.bgBrandSolid 정합). fill 은 반전 아님 — 대비 필요한 fg/border(underline) 만 light. 완전 둥근 chip 대신 토스 톤.
        // 크기는 size(default/sm) compoundVariant 로 — sm 은 모바일용 얇은 pill.
        pills:
          "leading-none rounded-r2 text-fg-neutral-muted hover:text-fg-neutral data-[state=active]:bg-[var(--bg-brand)] data-[state=active]:text-[var(--fg-on-brand)] data-[state=active]:font-semibold data-[state=active]:hover:text-[var(--fg-on-brand)]",
      },
      size: { default: "", sm: "" },
    },
    compoundVariants: [
      {
        variant: "pill",
        size: "default",
        class: "min-h-8 px-[var(--spacing-x3)] py-[var(--spacing-x1)] text-t4",
      },
      {
        variant: "pill",
        size: "sm",
        class: "min-h-7 px-[var(--spacing-x2)] py-[var(--spacing-x1)] text-t3",
      },
      // pills default — px-x3 py-x2 label-md (페이지 nav). sm — 얇은 pill(모바일 카테고리 필터).
      {
        variant: "pills",
        size: "default",
        class: "px-[var(--spacing-x3)] py-[var(--spacing-x2)] text-t4",
      },
      {
        variant: "pills",
        size: "sm",
        class: "min-h-7 px-[var(--spacing-x2)] py-[var(--spacing-x1)] text-t3",
      },
    ],
    defaultVariants: { variant: "pill", size: "default" },
  },
);

// pill size 를 List → Trigger 로 전파 (trigger 마다 size 재지정 불필요)
type TabsCtx = VariantProps<typeof tabsTriggerVariants>;
const TabsContext = React.createContext<TabsCtx>({});

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, size, ...props }, ref) => (
  <TabsContext.Provider value={{ variant, size }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  </TabsContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> &
  VariantProps<typeof tabsTriggerVariants>;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, size, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        tabsTriggerVariants({
          variant: variant ?? ctx.variant,
          size: size ?? ctx.size,
        }),
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-[var(--spacing-x2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
