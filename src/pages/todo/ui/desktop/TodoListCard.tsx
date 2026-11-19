import type { ReactNode, RefObject } from "react";
import { FunnelX, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { useDsText } from "@/shared/ds/i18n";
import { List } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { formatMonthDayDow, formatMonthShort } from "@/shared/lib/date";
import {
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
} from "@/shared/ui/groo/ledger";
import type { Todo } from "@/entities/todo";
import { NO_DUE, isDone } from "@/pages/todo/model/todo-ledger";
import { TodoRow } from "../TodoRow";
import { TodoDayGroupSkeleton } from "../todo-skeleton";

/**
 * 목록 카드 — 이번 달 날짜 묶음 (I-10 29). 머리 없는 목록 카드(위 12 · 아래 12), 묶음 머리는 List Header mediumWeak(머리말 h2) +
 * 오른쪽 "2/5 완료", 묶음 사이 위 12(첫 묶음은 카드 위 12 바로 아래). 줄은 폰과 같은 할 일 줄(체크 · 제목 · 태그 · 우선순위) — 줄 사이 선 없음.
 * 데스크톱 줄에는 밀기 · ⋮ 를 두지 않는다 — 수정 · 삭제는 상세에서(가계부 넓은 화면과 같다).
 * 범위 = 보고 있는 달 + 마감일 없는 묶음(맨 아래), 거르기가 걸리면 거른 결과. 불러오는 중 · 비어 있음 · 실패는 카드 안 Result Section.
 */
export function TodoListCard({
  groups,
  today,
  loading,
  failed,
  onRetry,
  filtered,
  monthNum,
  relOf,
  onToggle,
  onOpen,
  listRef,
}: {
  groups: [string, Todo[]][];
  today: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  filtered: boolean;
  monthNum: number;
  relOf: (d: string) => string | null;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  /** 날 누름이 묶음 머리로 옮길 때 찾는 목록 뿌리 */
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation("todo");
  const dsT = useDsText();

  let body: ReactNode;
  if (failed) {
    body = (
      <ResultSection
        size="medium"
        kind="failure"
        title={t("tdm.loadFailed")}
        description={t("tdm.loadFailedDesc")}
        primaryAction={{ label: dsT("common.retry"), onClick: onRetry }}
      />
    );
  } else if (loading) {
    body = (
      <div aria-busy="true">
        <TodoDayGroupSkeleton rows={3} />
        <TodoDayGroupSkeleton rows={2} className="mt-x3" />
      </div>
    );
  } else if (groups.length === 0) {
    body = filtered ? (
      <ResultSection
        size="medium"
        icon={<FunnelX />}
        title={t("tdm.emptyFilter")}
        description={t("tdm.emptyFilterDesc")}
      />
    ) : (
      <ResultSection
        size="medium"
        icon={<ListChecks />}
        title={t("tdm.emptyMonth", {
          month: monthNum,
          monthName: formatMonthShort(monthNum),
        })}
        // 넓은 화면에는 떠 있는 + 가 없다 — 제목 줄 버튼을 가리킨다(폰의 "오른쪽 아래 + 버튼" 이 아니다)
        description={t("tdm.emptyMonthDescWide")}
      />
    );
  } else {
    body = groups.map(([d, items]) => {
      const noDue = d === NO_DUE;
      const doneN = items.filter(isDone).length;
      return (
        <LedgerDayGroup
          key={d}
          day={noDue ? undefined : d}
          className="scroll-mt-x5 [&:first-child_[data-slot=list-header]]:mt-0"
        >
          <LedgerDayHead gutter>
            <LedgerDayDate relative={noDue ? null : relOf(d)}>
              {noDue ? t("tdm.noDue") : formatMonthDayDow(d)}
            </LedgerDayDate>
            <LedgerDaySum className="whitespace-nowrap">
              {t("tdm.doneRatio", { done: doneN, total: items.length })}
            </LedgerDaySum>
          </LedgerDayHead>
          <List>
            {items.map((td) => (
              <TodoRow
                key={td.rowId}
                todo={td}
                today={today}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </List>
        </LedgerDayGroup>
      );
    });
  }

  return (
    <div ref={listRef}>
      <Card body="list" data-slot="todo-list-card">
        {body}
      </Card>
    </div>
  );
}
