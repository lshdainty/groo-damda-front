import * as React from "react";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { calloutVariants } from "./callout-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Callout — 구조는 SEED Callout(2026-10-02). 수치 원본은 groo-design
 * specs/components/callout.yaml(값은 src/shared/ds/spec/callout.json).
 * groo-design recipes/shadcn/components/ui/callout.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 상자 변형(cva)은
 * callout-variants.ts 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 * "Alert" 라는 이름은 모달(Alert Dialog)에만 쓴다.
 *
 * 화면 안, 그 기능 · 내용 가까이에 늘 보이는 안내 상자 — 팁 · 제약 · 주의, 그 자리에서 난 오류(저장 실패는 폼 맨 위
 * critical, 폼은 연 채로). 페이지 전체의 상태는 Page Banner, 잠깐 알릴 결과는 Snackbar 다.
 *
 *   tone         neutral(기본) · informative · positive · warning · critical — 바탕 bg-*-weak, 글 · 아이콘 · 링크 · 화살표 ·
 *                닫기는 모두 fg-*-contrast(neutral 은 fg-neutral)
 *   interaction  display(기본, 보이기만 — 링크를 둘 수 있다) · actionable(상자 전체가 <button type="button"> + 뒤 화살표,
 *                링크는 두지 않는다) · dismissible(닫기 — 한 번 보면 되는 안내에만, 경고 · 오류는 닫지 못한다)
 *   title        성격을 나타내는 짧은 말(안내 · 주의 · 새 기능) — 본문과 한 문단
 *   children     본문 — 제목을 되풀이하지 않는다
 *   link         { label, href?, onClick? } — 보조 내용(자세히 · 약관)으로 갈 때만. href 면 <a>, 아니면 <button type="button">
 *   icon         앞 아이콘 — 주지 않으면 톤마다 lucide 선 아이콘(info · info · circle-check · triangle-alert · circle-alert),
 *                null 이면 두지 않는다
 *   role         나중에 나타나는 경고 · 위험(저장 실패)은 role="alert" 로 보조 기술에 알린다 — 처음부터 있던 안내는 알리지 않는다
 *
 * 상자 — 안쪽 14 · 최소 50 · 모서리 10 · 아이콘 16 · 사이 12, 여러 줄이면 아이콘 · 화살표 · 닫기가 가운데. 제목(700) ·
 *   본문(400) · 링크(400 + 밑줄, 띄움 2)는 모두 t4 이고 한 문단으로 흐른다 — 사이는 띄어쓰기 두 칸(진짜 글자라 복사해도
 *   이어 붙지 않고, 두 칸 뒤에서 줄을 바꿀 수 있다). 단어 단위 줄바꿈(v114).
 * Actionable — 호버 · 누름은 톤의 누름 바탕(bg-*-weak-pressed), 누르면 상자 전체가 2px 거리로 준다(기준 max(높이, 폭 ÷ 4, 24)
 *   를 누르는 순간 잰다 — SEED scaleScope: self). 모션 줄이기면 축소하지 않는다.
 * Dismissible — 닫기는 투명 상자 40 · 모서리 8, 바깥 여백 −12 로 줄 높이를 늘리지 않는다(아이콘은 오른쪽 끝에서 14).
 *   호버 · 누름은 톤의 누름 바탕, 누르면 2px 거리 축소(기준 40). 닫으면 바로 걷고(모션 없음) 초점은 다음 요소로 간다
 *   (뒤에 없으면 앞 요소 — body 로 떨어뜨리지 않는다). open · onDismiss 로 닫음을 기억해 다시 띄우지 않는다.
 *   open 을 주지 않으면 스스로 닫는다.
 * 버튼은 모두 type="button"(폼 안에서 제출되지 않게). 포커스 링은 키보드 포커스에만 2px · 띄움 2(stroke-focus-ring) —
 *   Actionable 은 상자 둘레, 링크 · 닫기는 그 둘레(모서리 4 · 8).
 */

export type CalloutTone =
  "neutral" | "informative" | "positive" | "warning" | "critical";

export interface CalloutLink {
  /** 링크 글 — 보조 내용으로 갈 때만("자세히" · "약관 보기") */
  label: string;
  /** 주면 <a href>, 없으면 <button type="button"> */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

type CalloutCommon = {
  tone?: CalloutTone;
  /** 제목 — 성격을 나타내는 짧은 말. 본문과 한 문단으로 이어진다 */
  title?: React.ReactNode;
  /** 앞 아이콘 — 주지 않으면 톤의 기본 아이콘, null 이면 두지 않는다 */
  icon?: React.ReactNode;
  /** 본문 */
  children: React.ReactNode;
};

type DivProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title" | "children"
>;

export type CalloutDisplayProps = CalloutCommon &
  DivProps & {
    interaction?: "display";
    link?: CalloutLink;
    /** 닫기는 dismissible 에만 */
    open?: never;
    onDismiss?: never;
  };

export type CalloutActionableProps = CalloutCommon &
  Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "title" | "children" | "type"
  > & {
    interaction: "actionable";
    /** 상자를 누르면 하는 일 */
    onClick: React.MouseEventHandler<HTMLButtonElement>;
    /** 상자 전체를 누르므로 링크는 두지 않는다 */
    link?: never;
    open?: never;
    onDismiss?: never;
  };

export type CalloutDismissibleProps = CalloutCommon &
  DivProps & {
    interaction: "dismissible";
    link?: CalloutLink;
    /** 보이는지 — 주면 부르는 쪽이 정한다(닫은 것을 기억해 다시 띄우지 않는다). 주지 않으면 스스로 닫는다 */
    open?: boolean;
    /** 닫기를 누르면 */
    onDismiss?: () => void;
  };

export type CalloutProps =
  CalloutDisplayProps | CalloutActionableProps | CalloutDismissibleProps;

// 톤의 기본 앞 아이콘 — lucide 선 아이콘(v106)
const TONE_ICON: Record<CalloutTone, typeof Info> = {
  neutral: Info,
  informative: Info,
  positive: CircleCheck,
  warning: TriangleAlert,
  critical: CircleAlert,
};

const ICON = "flex shrink-0 [&>svg]:size-[16px]";
// 한 문단 — 제목 · 본문 · 링크가 이어 흐른다(사이는 띄어쓰기 두 칸)
const CONTENT =
  "min-w-0 flex-1 text-t4 font-normal break-keep [overflow-wrap:break-word]";
const TITLE = "font-bold";
const SPACE = "whitespace-pre-wrap";
const LINK = [
  "inline-block cursor-pointer rounded-r1 text-t4 font-normal underline underline-offset-2",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
const CHEVRON = "size-[16px] shrink-0";

// 닫기 — 투명 상자 40 · 모서리 8, 바깥 −12. 호버 · 누름은 톤의 누름 바탕(아래 CLOSE_TONE), 누르면 2px 거리 축소(기준 40)
const CLOSE = [
  "relative -m-x3 flex size-[40px] shrink-0 cursor-pointer items-center justify-center rounded-r2 [&>svg]:size-[16px]",
  "[--press-basis:40] [transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
const CLOSE_TONE: Record<CalloutTone, string> = {
  neutral: "hover:bg-bg-neutral-weak-pressed active:bg-bg-neutral-weak-pressed",
  informative:
    "hover:bg-bg-informative-weak-pressed active:bg-bg-informative-weak-pressed",
  positive:
    "hover:bg-bg-positive-weak-pressed active:bg-bg-positive-weak-pressed",
  warning: "hover:bg-bg-warning-weak-pressed active:bg-bg-warning-weak-pressed",
  critical:
    "hover:bg-bg-critical-weak-pressed active:bg-bg-critical-weak-pressed",
};

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로(Button · Chip 과 같은 식). Space · Enter 에서도 잰다
function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

const isPressKey = (e: React.KeyboardEvent) =>
  e.key === " " || e.key === "Enter";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

// 닫은 뒤 초점이 갈 자리 — 상자 뒤의 첫 키보드 요소, 없으면 앞의 마지막 요소
const TABBABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';

function focusTargetAround(root: HTMLElement): HTMLElement | null {
  const all = Array.from(
    root.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE),
  ).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !root.contains(el) &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
  const after = all.find(
    (el) => root.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  if (after) return after;
  return (
    all
      .reverse()
      .find(
        (el) =>
          root.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING,
      ) ?? null
  );
}

// 닫기를 누르기 전에 자리를 잡아 두고, 다음 프레임에 상자가 정말 걷혔고 초점이 갈 곳을 잃었으면 그리로 옮긴다
// (부르는 쪽이 닫지 않았으면 — open 을 그대로 두면 — 그 자리에 둔다). 레시피의 useDismissFocus(useCallback 하나)를
// 함수로 풀었다 — 손 메모이제이션을 두지 않는다
function focusAfterDismiss(root: HTMLElement | null) {
  if (!root) return;
  const hadFocus = root.contains(document.activeElement);
  const target = hadFocus ? focusTargetAround(root) : null;
  requestAnimationFrame(() => {
    if (!target || root.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    target.focus();
  });
}

function CalloutLinkView({ link }: { link: CalloutLink }) {
  if (link.href != null) {
    return (
      <a
        data-slot="callout-link"
        href={link.href}
        onClick={link.onClick}
        className={LINK}
      >
        {link.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      data-slot="callout-link"
      onClick={link.onClick}
      className={LINK}
    >
      {link.label}
    </button>
  );
}

// 안쪽 — 앞 아이콘 · 한 문단(제목 · 본문 · 링크). 버튼 안에도 들어가므로 문단은 Actionable 에서 <span>
function Body({
  tone,
  icon,
  title,
  link,
  inline,
  children,
}: {
  tone: CalloutTone;
  icon: React.ReactNode;
  title: React.ReactNode;
  link?: CalloutLink;
  inline: boolean;
  children: React.ReactNode;
}) {
  const DefaultIcon = TONE_ICON[tone];
  const shownIcon = icon === undefined ? <DefaultIcon /> : icon;
  const Text = inline ? "span" : "p";
  return (
    <>
      {shownIcon != null && shownIcon !== false && (
        <span aria-hidden data-slot="callout-icon" className={ICON}>
          {shownIcon}
        </span>
      )}
      <Text data-slot="callout-content" className={CONTENT}>
        {title != null && title !== false && (
          <>
            <span data-slot="callout-title" className={TITLE}>
              {title}
            </span>
            <span className={SPACE}>{"  "}</span>
          </>
        )}
        <span data-slot="callout-description">{children}</span>
        {link && (
          <>
            <span className={SPACE}>{"  "}</span>
            <CalloutLinkView link={link} />
          </>
        )}
      </Text>
    </>
  );
}

type CalloutInternalProps = CalloutCommon & {
  interaction?: "display" | "actionable" | "dismissible";
  link?: CalloutLink;
  open?: boolean;
  onDismiss?: () => void;
  className?: string;
} & Record<string, unknown>;

const Callout = React.forwardRef<HTMLElement, CalloutProps>((props, ref) => {
  const dsT = useDsText();
  const {
    tone = "neutral",
    interaction = "display",
    title,
    icon,
    link,
    open,
    onDismiss,
    className,
    children,
    ...rest
  } = props as CalloutInternalProps;
  const own = React.useRef<HTMLElement>(null);
  const [selfOpen, setSelfOpen] = React.useState(true);

  if (interaction === "actionable") {
    const { onPointerDown, onKeyDown, ...buttonProps } =
      rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={mergeRefs(ref, own) as React.Ref<HTMLButtonElement>}
        type="button"
        data-slot="callout"
        data-tone={tone}
        data-interaction="actionable"
        className={cn(calloutVariants({ tone, interaction }), className)}
        onPointerDown={(e) => {
          measurePress(e.currentTarget);
          onPointerDown?.(e);
        }}
        onKeyDown={(e) => {
          if (isPressKey(e)) measurePress(e.currentTarget);
          onKeyDown?.(e);
        }}
        {...buttonProps}
      >
        <Body tone={tone} icon={icon} title={title} inline>
          {children}
        </Body>
        <ChevronRight
          aria-hidden
          data-slot="callout-chevron"
          className={CHEVRON}
        />
      </button>
    );
  }

  const shown = interaction === "dismissible" ? (open ?? selfOpen) : true;
  if (!shown) return null;

  const dismiss = () => {
    focusAfterDismiss(own.current);
    onDismiss?.();
    if (open === undefined) setSelfOpen(false);
  };

  return (
    <div
      ref={mergeRefs(ref, own) as React.Ref<HTMLDivElement>}
      data-slot="callout"
      data-tone={tone}
      data-interaction={interaction}
      className={cn(calloutVariants({ tone, interaction }), className)}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    >
      <Body tone={tone} icon={icon} title={title} link={link} inline={false}>
        {children}
      </Body>
      {interaction === "dismissible" && (
        <button
          type="button"
          data-slot="callout-close"
          aria-label={dsT("common.close")}
          className={cn(CLOSE, CLOSE_TONE[tone])}
          onClick={dismiss}
        >
          <X aria-hidden />
        </button>
      )}
    </div>
  );
});
Callout.displayName = "Callout";

export { Callout };
