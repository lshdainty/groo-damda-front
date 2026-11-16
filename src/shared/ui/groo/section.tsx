import type { CSSProperties, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * Section — 리스트형 화면의 공통 껍데기 (design primitives.jsx `Section` SoT 미러).
 *
 * 모바일 = 카드 다이어트: 카드 없이 flat-group 헤드(라벨 + 합계/액션) + 리스트.
 *   섹션 간 간격은 부모 컨테이너의 flex gap 이 담당 (margin 금지 — 중복 시 간격 어긋남).
 * 데스크톱 = 기존 Card(shadow) + CardHeader/CardContent.
 */
export function Section({
  mobile,
  title,
  total,
  totalColor,
  action,
  children,
  cardStyle,
  headGap,
}: {
  mobile: boolean;
  title: ReactNode;
  /** 우측 합계 표기 (예: 잔액 합) — null/undefined 면 숨김 */
  total?: ReactNode;
  totalColor?: string;
  /** 우측 액션 노드 (예: <button className="all">…) — total 과 동시 사용 가능 */
  action?: ReactNode;
  children: ReactNode;
  cardStyle?: CSSProperties;
  /**
   * 모바일 헤드↔리스트 간격(px). 생략하면 `.flat-group__head` 의 8.
   * 리스트 행이 자체 상단 패딩을 갖지 않는 화면은 여기서 전체 간격을 쥐어야
   * 행에 패딩이 있는 화면(홈 예산: 14+14)과 같아 보인다.
   */
  headGap?: number;
}) {
  if (mobile) {
    return (
      <section>
        <div
          className="flat-group__head"
          style={headGap != null ? { paddingBottom: headGap } : undefined}
        >
          <h2>{title}</h2>
          {total != null && (
            <span
              className="flat-group__total num"
              style={totalColor ? { color: totalColor } : undefined}
            >
              {total}
            </span>
          )}
          {action != null && (
            // total 이 없으면 action 이 우측 정렬을 담당 (.all 버튼은 자체 margin-left:auto).
            <span
              style={{
                marginLeft: total == null ? "auto" : undefined,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {action}
            </span>
          )}
        </div>
        <div>{children}</div>
      </section>
    );
  }
  return (
    <Card style={cardStyle}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle
          style={{
            fontSize: "var(--text-t5)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {title}
        </CardTitle>
        {total != null && (
          <span
            className="num"
            style={{
              marginLeft: "auto",
              fontSize: "var(--text-t3)",
              fontWeight: 700,
              color: totalColor,
            }}
          >
            {total}
          </span>
        )}
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
