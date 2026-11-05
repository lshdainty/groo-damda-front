import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import { useId, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ds/card";
import { ResponsivePair } from "@/shared/ds/button";
import { ListHeader } from "@/shared/ds/list";

/**
 * 데이터 내보내기 · 가져오기 화면이 같이 쓰는 구역 틀(I-05 52).
 *
 * - 데스크톱 · 태블릿(`mobile={false}`) — ds Card + CardHeader(제목 R4 t5 · 700). 카드 사이는 부르는 쪽이 8 로 쌓는다.
 * - 폰(`mobile`) — 띠 안의 묶음: 목록 제목(ListHeader `boldSolid`) + 본문. 구역 사이는 부르는 쪽이 위 24 로 둔다.
 *
 * `children` 은 `titleId` 를 받아 안의 묶음(radiogroup · fieldset)의 이름으로 잇는다.
 */
export function DataSection({
  mobile,
  title,
  description,
  list = false,
  heading = "title",
  footer,
  children,
}: {
  mobile: boolean;
  title: string;
  /** 구역 아래 설명 — R9 칸 설명(t4 · fg-neutral-subtle) */
  description?: string;
  /** 본문이 List 다 — 줄이 자기 좌우 24 를 가지므로 카드는 여백 없는 목록 카드(body="list"), 폰은 페이지 여백 밖까지 편다 */
  list?: boolean;
  /** 구역 머리 — "title"(기본: 카드 제목 R4 · 폰 boldSolid) · "listHeader"(목록 제목 R5 mediumWeak — 목록 구역) */
  heading?: "title" | "listHeader";
  /** 카드 바닥에 놓을 것(데스크톱 — 체크 · 버튼 줄은 카드 안 바닥 오른쪽, I-05 45). 폰은 본문 뒤에 그대로 이어진다 */
  footer?: ReactNode;
  children: (titleId: string) => ReactNode;
}) {
  const titleId = useId();
  const desc = description ? (
    <p
      className={
        list && !mobile
          ? "m-0 px-global-gutter text-t4 text-fg-neutral-subtle"
          : "m-0 text-t4 text-fg-neutral-subtle"
      }
    >
      {description}
    </p>
  ) : null;
  if (mobile) {
    return (
      <section aria-labelledby={titleId} className="flex flex-col gap-x2">
        {/* 폰 구역 머리 — 화면 여백은 페이지가 쥐고 있어 머리 좌우 여백을 걷는다 */}
        <ListHeader
          id={titleId}
          variant={heading === "listHeader" ? "mediumWeak" : "boldSolid"}
          className="px-0"
        >
          {title}
        </ListHeader>
        {desc}
        {list ? (
          <div className="-mx-global-gutter">{children(titleId)}</div>
        ) : (
          children(titleId)
        )}
        {footer}
      </section>
    );
  }
  if (list) {
    return (
      <Card aria-labelledby={titleId} body="list">
        {heading === "listHeader" ? (
          <ListHeader id={titleId} className="pt-x6">
            {title}
          </ListHeader>
        ) : (
          <CardHeader>
            <CardTitle id={titleId}>{title}</CardTitle>
          </CardHeader>
        )}
        {desc}
        {children(titleId)}
        {footer && (
          <div className="flex flex-col gap-x3 px-global-gutter pt-x3 pb-x3">
            {footer}
          </div>
        )}
      </Card>
    );
  }
  return (
    <Card aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {desc}
        {children(titleId)}
        {footer}
      </CardContent>
    </Card>
  );
}

/**
 * 화면 바닥 버튼 자리(I-05 45 · 48 · 50).
 *
 * 폰은 화면 바닥에 붙인다 — 흰 면 위 좌우 24 · 안전 영역 위, 짝은 ResponsivePair(라벨이 반 폭을 넘으면 쌓는다).
 * 데스크톱 · 태블릿은 카드 바닥 오른쪽(`end`) — 부르는 쪽이 `DataSection` 의 `footer` 로 카드 안에 넣는다.
 * 폰의 바는 sticky 라 자리 비움 숫자가 없다.
 */
export function ActionBar({
  mobile,
  children,
}: {
  mobile: boolean;
  children: ReactNode;
}) {
  if (mobile) {
    // 바닥에 붙는 띠(sticky)라 본문 끝에서 자기 높이만큼 자리를 차지한다 — 글자 200% · 버튼이 쌓여 바가 커져도 본문을 가리지 않는다.
    // 스크롤 상자의 좌우 · 아래 여백 24 를 음수로 되돌려 화면 끝까지 흰 면이다.
    // 스낵바는 이 띠 위 8 에 선다(SnackbarAvoidOverlap — 구독 바닥 띠와 같은 방식)
    return (
      <SnackbarAvoidOverlap>
        <div
          data-slot="data-action-bar"
          className="sticky bottom-0 z-(--z-sticky) -mx-global-gutter -mb-global-gutter bg-bg-layer-default px-x6 pt-x3 pb-[calc(var(--spacing-x6)+env(safe-area-inset-bottom))]"
        >
          <ResponsivePair>{children}</ResponsivePair>
        </div>
      </SnackbarAvoidOverlap>
    );
  }
  return (
    <div data-slot="data-action-bar" className="flex justify-end gap-x2">
      {children}
    </div>
  );
}
