import * as React from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useHoldReferenceNotice } from "@/shared/api";
import { Button } from "@/shared/ds/button";

import { resultSectionVariants } from "./result-section-variants";

/*
 * Groo Result Section — 구조는 SEED Result Section(2026-10-02). 수치 원본은 groo-design
 * specs/components/result-section.yaml(값은 src/shared/ds/spec/result-section.json).
 * groo-design recipes/shadcn/components/ui/result-section.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 묶음 모양(cva)은
 * result-section-variants.ts 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 * 화면이나 그 영역 가운데에 놓는 결과 — 비어 있음 · 불러오기 실패(다시 시도) · 완료 · 찾을 수 없는 페이지(404) · 화면 오류를
 * 한 틀로 그린다. 불러오기 실패를 "내역이 없어요" 처럼 비어 있음으로 보이지 않는다 — failure 로, 무엇을 불러오지 못했는지와
 * "다시 시도" 를 둔다. 이미 불러온 내용이 있으면 지우지 않고 다시 불러오기 실패는 Snackbar 로 가볍게 알린다.
 *
 *   kind            empty(기본 — 회색 아이콘, 무엇이 비었는지 말하는 아이콘을 꼭 준다) · failure(위험 색 느낌표) · done(성공 색 체크)
 *   size            large(기본 — 화면 전체: 제목 t8 22/30 · 설명 t5 · 사이 12 · 버튼 위 28) ·
 *                   medium(카드 · 섹션 · 시트 안: 제목 t5 16/22 · 설명 t4 · 사이 8 · 버튼 위 24)
 *   icon            아이콘 40 · 굵기 1.5 · 아래 16(lucide 선 아이콘). failure · done 은 주지 않으면 circle-alert · circle-check
 *   title           무슨 상태인지 한 줄(큰 글씨라 마침표 없이) — 제목 태그(as, 기본 h2 — 화면 전체면 그 화면의 제목 단계)
 *   description     왜 · 무엇을 하면 되는지, 해요체 + 마침표, 최대 두 줄을 권한다(fg-neutral-muted · 단어 단위 줄바꿈)
 *   primaryAction   첫 버튼 — 해결 · 다음 동작(다시 시도 · 거래 추가). Button neutralWeak medium 40
 *   secondaryAction 둘째 버튼 — 보조 동작(홈으로 · 다른 파일 가져오기). Button ghost small 36 — 위아래로 블리드(−8)해
 *                   글 자리만 차지한다. 버튼은 위아래로, 사이 20 — 블리드 때문에 상자 사이는 12(SEED 와 같다)
 *   (버튼: { label, onClick?, href?, loading? } — href 면 링크, loading 이면 Button 의 로딩 — "다시 시도" 하는 동안)
 *
 * 묶음 — 좌우 48 · 위아래 16, 놓인 자리의 가로 · 세로 가운데(부모가 flex 세로면 남는 높이를 채운다), 글은 가운데 정렬.
 * 카드(card.md) 안에서는 좌우 0 — 카드 안 여백 24(표의 빈 줄은 칸의 24)가 가장자리를 맡는다(2026-10-09 사용자 결정 23B).
 *   둘 다 두면 72 가 되어 폭 300 카드에서 제목이 두 줄로 넘어간다. 목록 카드(body="list")에 바로 두면 24 — 목록 카드는
 *   줄마다 24 를 가져 카드 여백이 없다. 목록 카드 바로 아래의 LoadingRegion 에 바로 둔 실패 · 비었음도 같다(영역은 자리만 잡는 겹).
 *   어느 카드에서나 글이 카드 끝에서 24 에 선다.
 * 결과로 바뀌면 투명도로 나타난다(150ms enter, 모션 줄이기면 바로). 묶음은 role="status" — 불러오는 중에서 결과로 바뀌면
 *   보조 기술이 읽는다. 처음부터 내용을 담고 붙은 status 는 읽히지 않으므로 처음 한 프레임은 내용을 감췄다가(visibility —
 *   자리는 그대로) 보인다. 아이콘은 장식(aria-hidden) — 상태는 제목이 말한다.
 */

export type ResultSectionKind = "empty" | "failure" | "done";
export type ResultSectionSize = "large" | "medium";

export interface ResultSectionAction {
  /** 동작 이름 — "다시 시도" · "홈으로" · "거래 추가" */
  label: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** 주면 링크(<a href>)로 그린다 */
  href?: string;
  /** 누른 일이 끝날 때까지 — Button 의 로딩(href 와 함께 쓰지 않는다) */
  loading?: boolean;
  /** 앞 아이콘 — 새로 만드는 동작("프리셋 추가" + plus)에만. 크기 · 간격은 Button 이 정한다(앱 `PResultAction.icon` 과 같은 이름) */
  icon?: React.ReactNode;
}

type ResultSectionCommon = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title" | "children"
> & {
  size?: ResultSectionSize;
  /** 무슨 상태인지 한 줄 — 마침표 없이 */
  title: React.ReactNode;
  /** 왜 · 무엇을 하면 되는지 — 최대 두 줄 */
  description?: React.ReactNode;
  primaryAction?: ResultSectionAction;
  secondaryAction?: ResultSectionAction;
  /** 제목 태그 — 기본 h2. 화면 전체 결과면 그 화면의 제목 단계로 */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

export type ResultSectionProps = ResultSectionCommon &
  (
    | {
        kind?: "empty";
        /** 무엇이 비었는지 말하는 아이콘(영수증 · 검색 · 알림 …) — 꼭 준다 */
        icon: React.ReactNode;
      }
    | {
        kind: "failure" | "done";
        /** 주지 않으면 failure 는 circle-alert, done 은 circle-check */
        icon?: React.ReactNode;
      }
  );

// 아이콘 — 40 · 굵기 1.5 · 아래 16, 색은 결과마다
const ASSET =
  "mb-x4 flex shrink-0 [&>svg]:size-[40px] [&>svg]:[stroke-width:1.5]";
const KIND_COLOR: Record<ResultSectionKind, string> = {
  empty: "text-fg-neutral-subtle",
  failure: "text-fg-critical",
  done: "text-fg-positive",
};

// 크기 — 제목 · 설명 글자와 사이, 버튼 위. Tailwind 는 소스의 글자 그대로를 읽으므로 두 크기를 다 적는다
const SIZES: Record<
  ResultSectionSize,
  { title: string; description: string; actions: string }
> = {
  large: { title: "text-t8", description: "mt-x3 text-t5", actions: "mt-x7" },
  medium: { title: "text-t5", description: "mt-x2 text-t4", actions: "mt-x6" },
};
const TITLE = "font-bold text-fg-neutral break-keep [overflow-wrap:break-word]";
const DESCRIPTION =
  "font-normal text-fg-neutral-muted break-keep [overflow-wrap:break-word]";
// 버튼 묶음 — 위아래로, 사이 20. 둘째 버튼이 위아래 −8 블리드해 상자 사이는 12 다(SEED 와 같다)
const ACTIONS = "flex flex-col items-center gap-x5";
// 둘째 버튼(ghost small 36)은 위아래 −8(Button small 의 위아래 여백) — 글 자리만 차지한다
const SECONDARY = "-my-x2";

function ActionButton({
  action,
  variant,
  size,
  className,
}: {
  action: ResultSectionAction;
  variant: "neutralWeak" | "ghost";
  size: "medium" | "small";
  className?: string;
}) {
  // 둘째 버튼 = 글 버튼(D2) — ghost small, 글자색 fg-neutral-muted
  const ghostColor = variant === "ghost" ? "neutralMuted" : undefined;
  if (action.href != null) {
    return (
      <Button
        asChild
        variant={variant}
        size={size}
        ghostColor={ghostColor}
        className={className}
      >
        <a href={action.href} onClick={action.onClick}>
          {action.icon}
          {action.label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      ghostColor={ghostColor}
      className={className}
      loading={action.loading}
      onClick={action.onClick}
    >
      {action.icon}
      {action.label}
    </Button>
  );
}

const ResultSection = React.forwardRef<HTMLDivElement, ResultSectionProps>(
  (
    {
      kind = "empty",
      size = "large",
      icon,
      title,
      description,
      primaryAction,
      secondaryAction,
      as: Heading = "h2",
      className,
      ...props
    },
    ref,
  ) => {
    // 실패 자리가 떠 있는 동안 공용 참조 실패 스낵바는 쉰다 — 이 자리가 이미 "불러오지 못했어요" 를 말한다.
    // 사라지면(다시 받기 성공 · 화면을 떠남) 참조 알림이 한 번 다시 판단한다(시트 보류와 같은 카운트)
    useHoldReferenceNotice(kind === "failure");
    // 처음 한 프레임은 내용을 감춘다 — status 에 나중에 들어온 내용이어야 보조 기술이 읽는다
    const [revealed, setRevealed] = React.useState(false);
    React.useEffect(() => {
      const frame = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(frame);
    }, []);

    const shownIcon =
      icon ??
      (kind === "failure" ? (
        <CircleAlert />
      ) : kind === "done" ? (
        <CircleCheck />
      ) : null);
    const s = SIZES[size];

    return (
      <div
        ref={ref}
        role="status"
        data-slot="result-section"
        data-kind={kind}
        data-size={size}
        className={cn(
          resultSectionVariants(),
          !revealed && "[&>*]:invisible",
          className,
        )}
        {...props}
      >
        {shownIcon != null && (
          <span
            aria-hidden
            data-slot="result-section-asset"
            className={cn(ASSET, KIND_COLOR[kind])}
          >
            {shownIcon}
          </span>
        )}
        <Heading
          data-slot="result-section-title"
          className={cn(TITLE, s.title)}
        >
          {title}
        </Heading>
        {description != null && description !== false && (
          <p
            data-slot="result-section-description"
            className={cn(DESCRIPTION, s.description)}
          >
            {description}
          </p>
        )}
        {(primaryAction || secondaryAction) && (
          <div
            data-slot="result-section-actions"
            className={cn(ACTIONS, s.actions)}
          >
            {primaryAction && (
              <ActionButton
                action={primaryAction}
                variant="neutralWeak"
                size="medium"
              />
            )}
            {secondaryAction && (
              <ActionButton
                action={secondaryAction}
                variant="ghost"
                size="small"
                className={SECONDARY}
              />
            )}
          </div>
        )}
      </div>
    );
  },
);
ResultSection.displayName = "ResultSection";

export { ResultSection };
