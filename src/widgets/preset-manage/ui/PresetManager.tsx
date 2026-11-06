import { useId, useMemo, useState } from "react";
import { Bookmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { List } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useUnconfirmedSnack } from "@/shared/lib/confirm-fail";
import { SwipeActions, type SwipeAction } from "@/shared/ds/swipe-actions";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { BandFailure, ListTitle } from "@/shared/ui/groo/band-parts";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import {
  useDeleteExpenseTemplate,
  useExpenseCategories,
  useExpenseTemplates,
} from "@/features/expense";
import { PresetListRow } from "@/features/expense/ui/preset-row";
import type { ExpenseTemplate } from "@/entities/expense-template";
import { PresetDetailDialog } from "./PresetDetailDialog";
import { PresetEditDialog } from "./PresetEditDialog";

type SortKey = "used" | "recent" | "name";

/** 정렬 칸 — 이름과 순서는 지금 그대로(화면에만 둔다, 서버 · 주소에 싣지 않는다) */
const SORTS: { key: SortKey; label: string }[] = [
  { key: "used", label: "preset.sortUsed" },
  { key: "recent", label: "preset.sortRecent" },
  { key: "name", label: "preset.sortName" },
];

/**
 * 프리셋 관리(I-20 C 13 ~ 18) — 한 목록: 목록 제목("프리셋 n개") → 정렬 Segmented → 줄. 안내 상자 · 숫자 셋은 없다.
 * 폰은 흰 면 하나(머리 오른쪽 "추가" 가 새 프리셋 — 비어 있으면 머리 버튼이 없고 본문 버튼 하나), 데스크톱은 제목 줄 [프리셋 추가] + 카드 하나다.
 * 줄 누름 = 상세(폰 · 데스크톱 모두), 폰은 밀어서 [수정][삭제]. 줄 끝 ⋮ 는 없다(10-25 줄 끝 ⋮ 원칙 — 지우기는 상세 바닥).
 */
export function PresetManager({
  mobile,
  addRequest = 0,
}: {
  mobile: boolean;
  /** 바깥(설정 폰 머리 "추가")이 올리면 추가 폼을 연다 */
  addRequest?: number;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const titleId = useId();
  const snackbar = useSnackbar();
  const unconfirmedSnack = useUnconfirmedSnack();
  // 불러오기 실패는 아래 실패 Result Section 이 알린다 — 전역 서버 원문 토스트와 겹치지 않게 끈다
  const templatesQ = useExpenseTemplates({ silent: true });
  // 카테고리 조회 실패도 같은 실패 한 벌(Result Section + 다시 시도)로 알린다 — 회색 타일로 "없는 카테고리" 처럼 읽히지 않게
  const categoriesQ = useExpenseCategories({ silent: true });
  // 삭제 실패는 전역 서버 원문 토스트 대신 아래 스낵바(고정 글 + 다시 시도)가 알린다
  const deleteMut = useDeleteExpenseTemplate({ silent: true });

  const [detail, setDetail] = useState<ExpenseTemplate | null>(null);
  const [editing, setEditing] = useState<ExpenseTemplate | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseTemplate | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<SortKey>("used");

  // 바깥(설정 폰 머리 "추가")이 올린 횟수가 바뀐 순간에만 새 폼을 연다. 렌더 중 조정이라 커밋을 한 번 더 태우지 않는다.
  const [seenAddRequest, setSeenAddRequest] = useState(addRequest);
  if (seenAddRequest !== addRequest) {
    setSeenAddRequest(addRequest);
    setEditing("new");
  }

  const isLoading = templatesQ.isLoading || categoriesQ.isLoading;
  const failed =
    !isLoading &&
    (templatesQ.data === undefined || categoriesQ.data === undefined);
  const items = useMemo(() => templatesQ.data ?? [], [templatesQ.data]);
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sortBy === "used") arr.sort((a, b) => b.useCount - a.useCount);
    if (sortBy === "name")
      arr.sort((a, b) => a.templateName.localeCompare(b.templateName, "ko"));
    if (sortBy === "recent") {
      arr.sort((a, b) =>
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
      );
    }
    return arr;
  }, [items, sortBy]);

  const categoryById = useMemo(() => {
    const m = new Map<number, (typeof categories)[number]>();
    for (const c of categories) m.set(c.rowId, c);
    return m;
  }, [categories]);

  // 실패는 확인창을 닫고 스낵바로 — 창 위에 겹치지 않는다. "다시 시도" 는 같은 삭제를 다시 한다
  const deleteFailed = (p: ExpenseTemplate, error: unknown) =>
    unconfirmedSnack(error, "delete") ||
    snackbar.show({
      message: t("preset.deleteFailed"),
      tone: "critical",
      action: {
        label: tc("retry"),
        onClick: () => {
          deleteMut
            .mutateAsync(p.rowId)
            .then(() => setDetail((d) => (d?.rowId === p.rowId ? null : d)))
            .catch((e: unknown) => deleteFailed(p, e));
        },
      },
    });

  const askDelete = (p: ExpenseTemplate) => setConfirmDelete(p);

  const onDelete = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    deleteMut.mutate(target.rowId, {
      onSuccess: () => {
        setConfirmDelete(null);
        // 지운 프리셋의 상세가 열려 있었으면 함께 닫는다
        setDetail((d) => (d?.rowId === target.rowId ? null : d));
      },
      onError: (error) => {
        setConfirmDelete(null);
        deleteFailed(target, error);
      },
    });
  };

  const sortControl = (
    <div className="px-global-gutter py-x1">
      <SegmentedControl
        aria-label={t("preset.sortLabel")}
        value={sortBy}
        onValueChange={(v) => setSortBy(v as SortKey)}
        className={mobile ? undefined : "w-[420px] max-w-full"}
      >
        {SORTS.map((s) => (
          <SegmentedControlItem key={s.key} value={s.key}>
            {t(s.label)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );

  const rows = sorted.map((p) => {
    const category =
      p.categoryRowId != null ? categoryById.get(p.categoryRowId) : undefined;
    const row = (
      <PresetListRow
        preset={p}
        category={category}
        onClick={() => setDetail(p)}
      />
    );
    if (!mobile) return row;
    // 밀면 수정 · 삭제 — 줄을 누르면 상세이므로 밀기는 지름길이다(swipe-actions.md · WCAG 2.1.1). 지우기는 확인창 한 번
    const actions: SwipeAction[] = [
      {
        label: tc("edit"),
        icon: <Pencil />,
        kind: "primary",
        onSelect: () => setEditing(p),
      },
      {
        label: tc("delete"),
        icon: <Trash2 />,
        kind: "destructive",
        onSelect: () => askDelete(p),
      },
    ];
    return (
      <SwipeActions
        key={p.rowId}
        rowLabel={p.templateName}
        enabled
        actions={actions}
      >
        <List>{row}</List>
      </SwipeActions>
    );
  });

  let content: React.ReactNode;
  if (isLoading) {
    content = <PresetListSkeleton />;
  } else if (failed) {
    content = (
      <BandFailure
        title={t("preset.loadFailed")}
        size={mobile ? "large" : "medium"}
        onRetry={() => {
          if (templatesQ.data === undefined) void templatesQ.refetch();
          if (categoriesQ.data === undefined) void categoriesQ.refetch();
        }}
      />
    );
  } else if (items.length === 0) {
    // 안내는 빈 화면에만 — 폰은 본문 버튼 하나, 데스크톱 카드 안은 제목 줄 [프리셋 추가] 가 있어 버튼이 없다
    content = (
      <ResultSection
        kind="empty"
        size={mobile ? "large" : "medium"}
        icon={<Bookmark />}
        title={t("preset.emptyTitle")}
        description={t("preset.emptyDesc")}
        primaryAction={
          mobile
            ? {
                label: t("preset.add"),
                icon: <Plus aria-hidden />,
                onClick: () => setEditing("new"),
              }
            : undefined
        }
        className="[[data-slot=card]_&]:px-0"
      />
    );
  } else {
    content = (
      <>
        <ListTitle id={titleId} first>
          {t("preset.listTitle", { count: items.length })}
        </ListTitle>
        {sortControl}
        {mobile ? (
          <div aria-labelledby={titleId} role="group">
            {rows}
          </div>
        ) : (
          <List aria-labelledby={titleId}>{rows}</List>
        )}
      </>
    );
  }

  return (
    <>
      {mobile ? (
        <div className="flex min-h-full flex-col pb-x6">{content}</div>
      ) : (
        <>
          <ManagerHead
            title={t("presets")}
            description={t("preset.manageDesc")}
            actions={
              // 제목 줄 오른쪽 주 동작 = Button small neutralOutline + 앞 아이콘 14, 글은 동작 이름(I-16 28)
              <Button
                variant="neutralOutline"
                size="small"
                onClick={() => setEditing("new")}
              >
                <Plus aria-hidden />
                {t("preset.add")}
              </Button>
            }
          />
          <Card body="list">
            <div className="pb-x6">{content}</div>
          </Card>
        </>
      )}

      {detail != null && (
        <PresetDetailDialog
          preset={detail}
          categories={categories}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          // 상세는 그대로 두고 그 위에 확인창 — [취소] 하면 상세로 돌아온다(I-20 C 18)
          onDelete={() => askDelete(detail)}
        />
      )}
      {editing != null && (
        <PresetEditDialog
          preset={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t("preset.deleteConfirmTitle", {
            name: confirmDelete.templateName,
          })}
          message={t("preset.deleteConfirmMessage")}
          confirmLabel={tc("delete")}
          danger
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={onDelete}
        />
      )}
    </>
  );
}

/** 불러오는 중 — 목록 제목 · 정렬 자리는 그대로, 줄만 Skeleton 넷(타일 40 · 두 줄 · 오른쪽 두 줄) */
function PresetListSkeleton() {
  return (
    <div aria-hidden>
      <div className="px-global-gutter py-x2">
        <Skeleton text="t4" className="w-1/4" />
      </div>
      <div className="px-global-gutter py-x1">
        <Skeleton radius="full" className="h-x10 w-full" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-x3 px-global-gutter py-x3">
          <Skeleton radius="12" className="size-x10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x1">
            <Skeleton text="t5" className="w-1/2" />
            <Skeleton text="t3" className="w-1/3" />
          </div>
          <div className="flex w-x20 shrink-0 flex-col items-end gap-x1">
            <Skeleton text="t5" className="w-full" />
            <Skeleton text="t3" className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
