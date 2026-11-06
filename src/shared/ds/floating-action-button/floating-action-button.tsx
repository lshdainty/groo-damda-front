import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";

import { ROOT } from "./floating-action-button-variants";

/*
 * Groo Floating Action Button — 구조는 SEED Floating Action Button(아이콘만 · extended=false, 2026-10-04).
 * 수치 원본은 groo-design specs/components/floating-action-button.yaml(값은 src/shared/ds/spec/floating-action-button.json).
 * recipes/shadcn/components/ui/floating-action-button.tsx 를 첫 판으로 가져왔다.
 *
 *   FloatingActionButton   화면 위에 떠 있는 그 화면의 주 동작 하나 — 오른쪽 아래의 브랜드 원 56 + 흰 아이콘 24.
 *     icon          lucide 선 아이콘(plus 등) — 보이는 글은 없다
 *     aria-label    필수 — 동작 이름("할 일 추가" · "더치페이 만들기"). 보이는 글이 없으니 이름이 곧 버튼의 글이다
 *     offsetBottom  아래에 고정된 것(바닥 버튼)의 높이 — 기본 0. 아래 안전 영역 위에 놓인 높이(안전 영역은 빼고)를 준다 —
 *                   버튼은 그 위 끝에서 20 에 선다
 *     그 밖은 <button> 속성(onClick …). type 은 늘 "button" 이다 — 폼 안에서 제출되지 않는다(SEED 는 type 이 없다)
 *
 * 폰(768 미만)의 탭 바가 없는 화면(할 일 · 더치페이)에만 둔다 — 탭 바가 있는 화면의 추가는 Bottom Navigation 가운데 +,
 * 데스크톱의 주 동작은 화면 머리의 Button 이다. 화면에 하나만, 글이 붙은 모양(Extended) · 스크롤에 따라 접기는 두지 않는다.
 *
 * 자리: 오른쪽 아래(fixed) — 화면 끝에서 20 + 오른쪽 안전 영역, 아래 끝(또는 바닥 고정 요소 위 끝)에서 20 + 아래 안전 영역.
 *   여백은 안전 영역 경계부터 잰다(Layout 의 Safe Area). 스크롤해도 그 자리에 있고 숨거나 접히지 않는다. 쌓임은 z-sticky 50(L1) —
 *   스낵바(L6)는 이 위 8 에 뜬다(SnackbarAvoidOverlap 으로 감싼다 — ref 는 버튼에 닿는다).
 * 모양: 원 56 · bg-brand-solid(Desk 파랑 · HR 초록, 바꾸지 않는다) · 흰 아이콘(static-white · 선 2.5) · 그림자 shadow-s3(다크는 -dark 짝).
 *   목록의 마지막 줄이 가리지 않게 목록 아래에 버튼 높이만큼 여백(56 + 20 + 20)을 두는 것은 쓰는 쪽의 몫이다.
 * 상태: 호버(웹) · 누름 bg-brand-solid-pressed, 누르면 2px 거리 축소(기준 56 → 0.964 — 모션 줄이기면 하지 않는다),
 *   키보드 포커스에만 원 바깥 2px 링(stroke-focus-ring · 띄움 2).
 * 모션: 색 150ms easing · 축소 150ms pressed-scale.
 *
 * 레시피와 다른 자리 — 클래스는 floating-action-button-variants.ts 로 나눴다(컴포넌트 파일은 컴포넌트만). 그 밖은 같다.
 */

export interface FloatingActionButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children" | "aria-label"
> {
  /** lucide 선 아이콘 — 흰 24 · 선 2.5 로 그린다 */
  icon: React.ReactNode;
  /** 동작 이름 — 보이는 글이 없으니 꼭 준다("할 일 추가") */
  "aria-label": string;
  /** 아래 고정 요소(바닥 버튼)의 높이 px — 안전 영역 위에 놓인 높이. 버튼은 그 위 끝에서 20 에 선다(기본 0) */
  offsetBottom?: number;
}

const FloatingActionButton = React.forwardRef<
  HTMLButtonElement,
  FloatingActionButtonProps
>(({ icon, offsetBottom = 0, className, style, ...props }, ref) => (
  // 스낵바는 이 버튼 윗변 위 8 에 선다 — 감싸면 ref 가 버튼에 닿는다(Provider 밖이면 아무것도 하지 않는다)
  <SnackbarAvoidOverlap>
    <button
      ref={ref}
      type="button"
      data-slot="floating-action-button"
      className={cn(ROOT, className)}
      style={
        offsetBottom
          ? ({
              "--fab-offset-bottom": `${offsetBottom}px`,
              ...style,
            } as React.CSSProperties)
          : style
      }
      {...props}
    >
      {/* 아이콘은 장식 — 이름은 aria-label */}
      {React.isValidElement<{ "aria-hidden"?: unknown }>(icon)
        ? React.cloneElement(icon, { "aria-hidden": true })
        : icon}
    </button>
  </SnackbarAvoidOverlap>
));
FloatingActionButton.displayName = "FloatingActionButton";

export { FloatingActionButton };
