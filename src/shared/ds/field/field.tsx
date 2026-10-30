import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { FieldContext, join, type FieldContextValue } from "./field-context";

/*
 * Groo Field — 구조는 SEED Field(2026-10-01). 수치 원본은 groo-design
 * specs/components/field.yaml(값은 src/shared/ds/spec/field.json).
 * groo-design recipes/shadcn/components/ui/field.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 이 파일은 컴포넌트,
 * 입력 · 묶음이 쓰는 문맥 · 훅 · 자소 셈은 field-context.ts 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 *   Field            머리(라벨 · 필수 점 또는 "선택" · 보조 액션) · 입력 · 꼬리(설명 또는 오류 · 글자 수). 사이 8
 *   useFieldControl  입력(Input · Textarea)이 Field 의 id · 설명 · 오류 · 필수 · 막힘을 받는다
 *   useFieldGroup    묶음(Checkbox · Radio · Select Box)이 Field 의 라벨을 이름으로, 설명 · 오류를 설명으로 받는다
 *   useTextControl   입력 · 여러 줄 입력의 글자 수 — 자소 단위로 세고 최대에서 자른다(한글 조합이 끝난 뒤)
 *
 * 라벨은 칸과 잇는다 — 입력이면 <label for>, 묶음이면 묶음의 aria-labelledby(라벨은 <span>).
 * 칸이 버튼(Input Button · Select 의 트리거)이면 라벨을 눌러도 포커스만 옮긴다 — 누르지 않는다(시트 · 목록을 열지 않는다, SEED).
 * 필수 점은 화면 읽기 프로그램에 숨기고 필수는 칸의 aria-required 가 알린다 — required 속성은 쓰지 않는다
 * (브라우저 기본 말풍선이 오류 글 대신 뜨지 않게). 필수 점 · "선택" 은 한 화면에서 섞지 않는다(2/3 규칙 — field.md).
 * 오류 글(invalid + errorMessage)은 설명 자리를 대신하고 칸의 aria-describedby 로 이어진다. 바뀔 때는 화면 밖의
 * polite 알림 자리가 한 번 읽는다 — 보이는 오류 글은 그 자리와 두 번 읽히지 않게 aria-hidden(설명으로는 그대로 읽힌다).
 * 글자 수(maxGraphemeCount)는 최대가 있는 칸에만 — 국기 이모지도 한 글자다. 입력은 최대에서 멈춘다.
 */

export interface FieldProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "id" | "children"
> {
  /** 칸 이름 — 명사형 · 마침표 없이 */
  label?: React.ReactNode;
  /** 라벨 굵기 — medium 500(기본) · bold 700 */
  labelWeight?: "medium" | "bold";
  /** 필수 — 칸의 aria-required. 점은 showRequiredIndicator 로 따로 켠다(2/3 규칙) */
  required?: boolean;
  /** 필수 점 — 한 화면 칸의 2/3 미만이 필수일 때 필수 칸에만. 켜면 필수(required)로 본다 */
  showRequiredIndicator?: boolean;
  /** 라벨 뒤 글 — 2/3 이상이 필수인 화면의 선택 칸에 "선택" */
  indicator?: React.ReactNode;
  /**
   * 라벨을 보이지 않게 둔다 — 화면에 라벨이 없어도 읽는 이름은 남는다(`<label for>` 그대로). 머리 줄째 흐름에서 빠져
   * (sr-only) 칸 위에 gap 이 한 칸 더 생기지 않는다 — 제목 칸처럼 자리 글이 이름을 대신하는 입력에 쓴다.
   * `headerAction` 이 있으면 머리가 보여야 하므로 무시한다
   */
  labelHidden?: boolean;
  /** 라벨 오른쪽 보조 액션 — Button ghost · neutralSubtle · xsmall · flush="right" */
  headerAction?: React.ReactNode;
  /** 설명 — 오류가 있으면 오류가 대신한다 */
  description?: React.ReactNode;
  /** 설명 앞 아이콘(16) */
  descriptionIcon?: React.ReactNode;
  /** 오류 글 — invalid 일 때 설명 자리에. 행동 지시형으로 짧게 */
  errorMessage?: React.ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** 최대 글자 수(자소 단위) — 있으면 꼬리 오른쪽에 "n/최대" 를 보이고 입력은 최대에서 멈춘다 */
  maxGraphemeCount?: number;
  /** 입력의 id — 라벨이 이 id 로 간다(없으면 만든다) */
  id?: string;
  children: React.ReactNode;
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      label,
      labelWeight = "medium",
      labelHidden = false,
      required = false,
      showRequiredIndicator = false,
      indicator,
      headerAction,
      description,
      descriptionIcon,
      errorMessage,
      invalid = false,
      disabled = false,
      readOnly = false,
      maxGraphemeCount,
      id,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const auto = React.useId();
    const [controlIdOverride, setControlId] = React.useState<string>();
    const [group, setGroup] = React.useState(false);
    const [count, setGraphemeCount] = React.useState(0);
    const controlId = id ?? controlIdOverride ?? `${auto}control`;
    const labelId = `${auto}label`;
    const descriptionId = `${auto}description`;
    const errorId = `${auto}error`;
    const countId = `${auto}count`;
    const isRequired = required || showRequiredIndicator;
    const showError =
      invalid &&
      errorMessage != null &&
      errorMessage !== false &&
      errorMessage !== "";
    const showDescription =
      !showError &&
      description != null &&
      description !== false &&
      description !== "";
    const showCount = maxGraphemeCount != null;
    const describedBy = join(
      showError && errorId,
      showDescription && descriptionId,
      showCount && countId,
    );

    // 문맥 값 — 손 메모이제이션은 두지 않는다(React Compiler). 이 값의 정체에 기대는 효과는 없다
    const value: FieldContextValue = {
      controlId,
      labelId,
      describedBy,
      invalid,
      required: isRequired,
      disabled,
      readOnly,
      maxGraphemeCount,
      setGraphemeCount,
      setControlId,
      setGroup,
    };

    const labelClass = cn(
      "min-w-0 break-keep font-sans text-t5 text-fg-neutral",
      labelWeight === "bold" ? "font-bold" : "font-medium",
    );
    // 칸이 버튼이면 라벨의 기본 동작(칸을 누르기)을 막고 포커스만 옮긴다 — 입력칸은 그대로(포커스 · 커서)
    const onLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      const control = e.currentTarget.ownerDocument.getElementById(controlId);
      if (control?.tagName !== "BUTTON") return;
      e.preventDefault();
      control.focus();
    };
    const labelContent = (
      <>
        {label}
        {showRequiredIndicator && (
          <span
            aria-hidden
            className="ml-[2px] mt-[4px] inline-block size-[6px] rounded-full bg-fg-critical align-top"
          />
        )}
        {!showRequiredIndicator && indicator != null && (
          <span className="pl-[4px] align-bottom text-t4 font-normal leading-[var(--text-t5--line-height)] text-fg-neutral-subtle">
            {indicator}
          </span>
        )}
      </>
    );

    return (
      <FieldContext.Provider value={value}>
        <div
          ref={ref}
          data-slot="field"
          data-invalid={invalid || undefined}
          data-disabled={disabled || undefined}
          className={cn("flex w-full min-w-0 flex-col gap-x2", className)}
          {...props}
        >
          {(label != null || headerAction != null) && (
            <div
              data-slot="field-header"
              className={
                labelHidden && headerAction == null
                  ? "sr-only"
                  : "flex flex-wrap items-center justify-between gap-x2_5 px-x0_5"
              }
            >
              {label != null &&
                (group ? (
                  <span id={labelId} className={labelClass}>
                    {labelContent}
                  </span>
                ) : (
                  <label
                    id={labelId}
                    htmlFor={controlId}
                    className={labelClass}
                    onClick={onLabelClick}
                  >
                    {labelContent}
                  </label>
                ))}
              {headerAction != null && (
                <div
                  data-slot="field-header-action"
                  className="-my-[5px] ml-auto flex shrink-0 items-center"
                >
                  {headerAction}
                </div>
              )}
            </div>
          )}
          {children}
          {(showError || showDescription || showCount) && (
            <div
              data-slot="field-footer"
              className="flex items-start gap-x2 px-x0_5 font-sans"
            >
              {showError && (
                <p
                  id={errorId}
                  aria-hidden
                  className="m-0 flex min-w-0 text-t4 text-fg-critical"
                >
                  <CircleAlert
                    aria-hidden
                    className="mr-x1_5 mt-[calc((var(--text-t4--line-height)_-_1rem)/2)] size-[16px] shrink-0"
                  />
                  <span className="min-w-0">{errorMessage}</span>
                </p>
              )}
              {showDescription && (
                <p
                  id={descriptionId}
                  className="m-0 flex min-w-0 text-t4 text-fg-neutral-subtle"
                >
                  {descriptionIcon != null && (
                    <span
                      aria-hidden
                      className="mr-x1_5 mt-[calc((var(--text-t4--line-height)_-_1rem)/2)] flex shrink-0 [&>svg]:size-[16px]"
                    >
                      {descriptionIcon}
                    </span>
                  )}
                  <span className="min-w-0">{description}</span>
                </p>
              )}
              {showCount && (
                <p
                  id={countId}
                  className="m-0 ml-auto shrink-0 text-t4 tabular-nums"
                >
                  <span
                    className={
                      invalid
                        ? "text-fg-critical"
                        : count === 0
                          ? "text-fg-neutral-subtle"
                          : "text-fg-neutral"
                    }
                  >
                    {count}
                  </span>
                  <span
                    className={
                      invalid ? "text-fg-critical" : "text-fg-neutral-subtle"
                    }
                  >
                    /{maxGraphemeCount}
                  </span>
                </p>
              )}
            </div>
          )}
          <span className="sr-only" aria-live="polite">
            {showError ? errorMessage : null}
          </span>
        </div>
      </FieldContext.Provider>
    );
  },
);
Field.displayName = "Field";

export { Field };
