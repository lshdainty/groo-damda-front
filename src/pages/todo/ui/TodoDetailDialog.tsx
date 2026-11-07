import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { List, ListHeader, ListItem } from "@/shared/ds/list";
import { cn } from "@/shared/lib/cn";
import { formatServerDateDowTime } from "@/shared/lib/date";
import { dueKey } from "@/pages/todo/model/todo-ledger";
import { isDone } from "@/pages/todo/model/todo-ledger";
import { kDate, todoTagLabel } from "@/pages/todo/model/todo-view";
import { TodoDeleteConfirm } from "./TodoDeleteConfirm";
import type { Todo } from "@/entities/todo";

/**
 * 할 일 상세 — ds Responsive Dialog 조회(1280 이상 대화상자 480 · 미만 Bottom Sheet — I-10 21). 바깥 누름 · 끌어내림으로 닫힌다.
 * 본문 맨 위는 제목(t6 · 700 · 줄바꿈, 끝냈으면 취소선 + fg-disabled) — 틴트 머리 카드 · 원 아이콘 · 가운데 맞춤은 없다.
 * 그 아래 보기만 하는 List 줄(마감일 · 태그 · 우선순위 · 상태 · 완료 일시)과, 메모는 줄 아래 따로 List Header + 본문이다.
 * 바닥은 [삭제] neutralWeak · [수정] neutralSolid. 삭제는 Alert Dialog 로 한 번 묻는다.
 */
export function TodoDetailDialog({
  todo,
  today,
  onClose,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  today: string;
  onClose: () => void;
  onEdit: (todo: Todo) => void;
  /** 지운다 — 끝날 때까지 확인창이 로딩을 문다 */
  onDelete: (id: number) => Promise<unknown>;
}) {
  const { t } = useTranslation("todo");
  const { t: tc } = useTranslation("common");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = isDone(todo);
  const key = dueKey(todo.dueDate);
  const overdue = !done && !!key && key < today;

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <ResponsiveDialogContent title={t("detailTitle")}>
          <ResponsiveDialogBody>
            <h3
              className={cn(
                "m-0 pb-x2 font-sans text-t6 font-bold [overflow-wrap:anywhere]",
                done ? "text-fg-disabled line-through" : "text-fg-neutral",
              )}
            >
              {todo.title}
            </h3>
            {/* 줄이 제 좌우 24 를 갖는다 — 본문 여백 24 를 풀어 화면 끝까지 */}
            <List className="-mx-x6 w-[calc(100%+var(--spacing-x12))]">
              <ListItem
                title={t("form.dueDate")}
                suffixText
                suffix={
                  key ? (
                    <span className={cn(overdue && "text-fg-critical")}>
                      {kDate(key).full}
                      {overdue ? `, ${t("detail.overdue")}` : ""}
                    </span>
                  ) : (
                    t("noDueDate")
                  )
                }
              />
              <ListItem
                title={t("tag")}
                suffixText
                suffix={todoTagLabel(todo)}
              />
              <ListItem
                title={t("form.priority")}
                suffix={
                  <Badge
                    variant="weak"
                    tone={todo.priority === "HIGH" ? "critical" : "neutral"}
                  >
                    {t(`prio.${todo.priority}`)}
                  </Badge>
                }
              />
              <ListItem
                title={t("detail.status")}
                suffix={done ? t("status.COMPLETED") : t("status.PENDING")}
              />
              {done && todo.completedAt && (
                <ListItem
                  title={t("detail.completedAt")}
                  suffixText
                  // completedAt 은 `[UTC]` — 파싱해서 로컬 시각으로 찍는다. 못 읽으면 원문을 그대로 보여 준다
                  // (앱 todo_detail_dialog 와 같은 폴백) — 값 칸을 비우면 "완료 시각이 없다" 로 읽혀 서버가 준 값이 사라진다
                  suffix={
                    formatServerDateDowTime(todo.completedAt) ??
                    todo.completedAt
                  }
                />
              )}
            </List>
            {/* 메모는 키-값 줄 값으로 두지 않는다 — 10,000자가 값 칸에 들지 않는다 */}
            <ListHeader as="h3" className="px-0 pt-x4">
              {t("form.memo")}
            </ListHeader>
            {todo.content ? (
              <p className="m-0 whitespace-pre-wrap font-sans text-t5 font-normal text-fg-neutral [overflow-wrap:anywhere]">
                {todo.content}
              </p>
            ) : (
              <p className="m-0 font-sans text-t5 font-normal text-fg-neutral-subtle">
                {t("detail.none")}
              </p>
            )}
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              variant="neutralWeak"
              onClick={() => setConfirmDelete(true)}
            >
              {tc("delete")}
            </Button>
            <Button variant="neutralSolid" onClick={() => onEdit(todo)}>
              {tc("edit")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {confirmDelete && (
        <TodoDeleteConfirm
          name={todo.title}
          onConfirm={() => onDelete(todo.rowId)}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
