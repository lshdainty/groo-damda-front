import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRightLeft,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { Icon } from "@/shared/ui/groo/primitives";
import { cn } from "@/shared/lib/cn";
import { isIconName } from "@/shared/lib";
import { MINUS, money } from "@/shared/lib/groo/format";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import {
  useDeleteRecurringTransaction,
  useRecurringTransactions,
  useToggleRecurringTransaction,
} from "@/features/recurring-transaction";
import { useExpenseCategories } from "@/features/expense";
import type { ExpenseCategory } from "@/entities/expense";
import type { RecurringTransaction } from "@/entities/recurring-transaction";
import {
  displayTitle,
  recurringAmountTone,
  rowDetailParts,
} from "@/features/recurring-transaction/lib/recurring-format";
import {
  isPaused,
  monthTotal,
} from "@/features/recurring-transaction/lib/recurring-schedule";
import { RecurringAddDialog } from "@/features/recurring-transaction/ui/RecurringAddDialog";
import { RecurringDetailDialog } from "@/features/recurring-transaction/ui/RecurringDetailDialog";

/*
 * 빈 배열 상수 — `data ?? []` 는 로딩 중 매 렌더 **새 배열**이 되어 참조가 흔들린다. 상수를 돌려주면 참조가 고정된다.
 */
const EMPTY_ITEMS: RecurringTransaction[] = [];
const EMPTY_CATEGORIES: ExpenseCategory[] = [];

const KINDS = ["EXPENSE", "INCOME", "TRANSFER"] as const;
type Kind = (typeof KINDS)[number];

/**
 * 반복 거래 관리(I-20 D 21 ~ 25) — 종류별 묶음(지출 → 수입 → 이체) + 묶음 머리 오른쪽 "이번 달" 합 + 줄.
 * 줄을 누르면 상세(그 안에서 일시정지 · 수정 · 삭제), 폰은 밀어서 [수정][삭제]. 줄 끝에는 ⋮ 를 두지 않는다(좁은 목록 줄).
 * 폰은 머리 오른쪽 "추가"(바깥에서 `addRequest`), 데스크톱은 제목 줄 [반복 거래 추가] + 카드 하나다.
 */
export function RecurringManager({
  mobile,
  addRequest = 0,
  now = new Date(),
}: {
  mobile: boolean;
  /** 바깥(설정 폰 머리 "추가")이 올리면 추가 폼을 연다 */
  addRequest?: number;
  /** 이번 달을 정하는 '오늘' — 시험이 고정한다 */
  now?: Date;
}) {
  const { t } = useTranslation("recurring");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("settings");
  const recurringsQ = useRecurringTransactions(undefined, { silent: true });
  const categoriesQ = useExpenseCategories({ reference: true });
  // 일시정지 · 삭제의 실패는 아래 스낵바가 고정 글로 알린다(서버 원문 전역 토스트는 끈다)
  const toggleMut = useToggleRecurringTransaction({ silent: true });
  const deleteMut = useDeleteRecurringTransaction({ silent: true });
  const snackbar = useSnackbar();

  const isLoading = recurringsQ.isLoading;
  const failed = recurringsQ.isError && !recurringsQ.data;
  const items = recurringsQ.data ?? EMPTY_ITEMS;
  const categories = categoriesQ.data ?? EMPTY_CATEGORIES;

  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [seenAddRequest, setSeenAddRequest] = useState(addRequest);
  if (seenAddRequest !== addRequest) {
    setSeenAddRequest(addRequest);
    setAdding(true);
  }
  const [confirmDelete, setConfirmDelete] =
    useState<RecurringTransaction | null>(null);
  // 상세는 id 로 든다 — 일시정지 · 다시 켜기 뒤 새 값으로 다시 그려야 한다
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = items.find((i) => i.rowId === detailId) ?? null;

  // 확인창 · 버튼 뒤 요청의 실패 — 공용 훅: critical 스낵바 + [다시 시도](묻지 않고 같은 요청을 바로)
  const confirmFail = useConfirmFail();
  const togglePause = (it: RecurringTransaction) => {
    if (toggleMut.isPending) return;
    const name = displayTitle(it, t);
    const wasActive = it.isActive === "Y";
    const done = () =>
      snackbar.show({
        message: wasActive
          ? t("toastPaused", { name })
          : t("toastResumed", { name }),
      });
    toggleMut.mutate(it.rowId, {
      onSuccess: done,
      // 응답을 못 받았으면(뒤집혔을 수 있다) [다시 시도] 없이 다시 받은 서버 값 + "바뀌었는지 확인하지 못했어요."(판단 ②).
      // 그 밖의 실패는 [다시 시도] 를 남긴다 — 앱(recurring_actions.dart _toggleBody)과 같게 다시 시도는 먼저 서버 상태를 받아
      // 이미 목표 상태면 보내지 않는다(뒤집기 API 라도 두 번 뒤집히지 않는다)
      onError: (error) =>
        confirmFail({
          error,
          unconfirmedKind: "toggle",
          message: t(wasActive ? "pauseFailed" : "resumeFailed"),
          retry: async () => {
            const r = await recurringsQ.refetch();
            const cur = r.data?.find((x) => x.rowId === it.rowId);
            if (cur && (cur.isActive === "Y") === !wasActive) return;
            await toggleMut.mutateAsync(it.rowId);
          },
          onRetried: done,
        }),
    });
  };

  const deleteFailed = (it: RecurringTransaction, error: unknown) =>
    confirmFail({
      error,
      message: t("deleteFailed"),
      retry: () => deleteMut.mutateAsync(it.rowId),
      onRetried: () =>
        snackbar.show({
          message: t("toastDeleted", { name: displayTitle(it, t) }),
        }),
    });

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const groups = KINDS.map((kind) => ({
    kind,
    list: items.filter((i) => i.expenseType === kind),
    total: kind === "TRANSFER" ? null : monthTotal(items, kind, year, month),
  })).filter((g) => g.list.length > 0);

  const swipeActions = (it: RecurringTransaction) => [
    {
      label: tc("edit"),
      icon: <Pencil />,
      kind: "primary" as const,
      onSelect: () => setEditing(it),
    },
    {
      label: tc("delete"),
      icon: <Trash2 />,
      kind: "destructive" as const,
      onSelect: () => setConfirmDelete(it),
    },
  ];

  const kindLabel = (k: Kind) =>
    t(
      k === "EXPENSE"
        ? "kindExpense"
        : k === "INCOME"
          ? "kindIncome"
          : "kindTransfer",
    );

  const row = (it: RecurringTransaction) => {
    const tone = recurringAmountTone(it);
    const cat = categories.find((c) => c.rowId === it.categoryRowId);
    const palette = getPaletteByColor(cat?.color);
    const paused = isPaused(it);
    const title = displayTitle(it, t);
    const li = (
      <ListButtonItem
        key={it.rowId}
        prefix={
          <ListTile
            className={
              it.expenseType === "TRANSFER"
                ? "bg-bg-neutral-weak text-fg-neutral"
                : undefined
            }
            style={
              it.expenseType === "TRANSFER"
                ? undefined
                : { background: palette.bg, color: palette.color }
            }
          >
            {it.expenseType === "TRANSFER" ? (
              <ArrowRightLeft aria-hidden />
            ) : (
              <Icon
                name={cat && isIconName(cat.icon) ? cat.icon : "tag"}
                size={20}
              />
            )}
          </ListTile>
        }
        title={
          <>
            {title}
            {it.autoLog && (
              <Zap
                role="img"
                aria-label={t("autoLog")}
                className="ml-x1 inline size-3.5 align-[-1px] text-fg-brand"
              />
            )}
          </>
        }
        detail={
          // 항목 통째로 줄바꿈 — 잘리면 뜻 없는 항목(날짜 · 주기)이라 말줄임 대신 다음 줄로 넘긴다(20-4 CardRow 와 같은 방식)
          <TagGroup size="t3">
            {rowDetailParts(it, t).map((part, i) => (
              <TagGroupItem key={i} className="whitespace-nowrap">
                {/* 항목 안 띄어쓰기는 NBSP — 항목은 한 덩어리로 다음 줄에 넘어간다(글 칸이 normal 이라 nowrap 만으로는 안쪽에서 끊긴다) */}
                {part.replace(/ /g, "\u00a0")}
              </TagGroupItem>
            ))}
          </TagGroup>
        }
        suffix={
          <span className="flex flex-col items-end gap-x1">
            <span
              className={cn(
                "text-end text-t5 font-bold tabular-nums",
                tone.className,
              )}
            >
              <MaskAmount card="etc.recurring">
                {tone.sign}
                {money(Math.abs(it.amount))}
              </MaskAmount>
            </span>
            {paused && <Badge>{t("paused")}</Badge>}
          </span>
        }
        onClick={() => setDetailId(it.rowId)}
      />
    );
    return mobile ? (
      <SwipeActions
        key={it.rowId}
        rowLabel={title}
        enabled
        actions={swipeActions(it)}
      >
        {li}
      </SwipeActions>
    ) : (
      li
    );
  };

  const groupHead = (g: (typeof groups)[number], first: boolean) => (
    <ListHeader
      as="div"
      variant="boldSolid"
      className={first ? (mobile ? "mt-x2" : undefined) : "mt-x4"}
    >
      <h2 className="m-0 min-w-0 font-[inherit] text-[length:inherit]">
        {t("groupTitle", { kind: kindLabel(g.kind), count: g.list.length })}
      </h2>
      {g.total != null && (
        <span className="shrink-0 whitespace-nowrap text-end tabular-nums">
          {t("monthLead")}{" "}
          <MaskAmount card="etc.recurring">
            {/* 0 은 부호 없이 "0원"(앱 _MonthTotal 과 같다) */}
            {`${g.total === 0 ? "" : g.kind === "EXPENSE" ? MINUS : "+"}${money(g.total)}`}
          </MaskAmount>
        </span>
      )}
    </ListHeader>
  );

  let body;
  if (isLoading) {
    body = <RecurringSkeleton />;
  } else if (failed) {
    body = (
      <BandFailure
        title={t("loadFailed")}
        onRetry={() => void recurringsQ.refetch()}
        band={mobile}
        size={mobile ? "large" : "medium"}
      />
    );
  } else if (items.length === 0) {
    body = (
      <ResultSection
        kind="empty"
        size={mobile ? "large" : "medium"}
        as="h2"
        icon={<Repeat aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDesc")}
        primaryAction={
          mobile
            ? {
                label: t("addTitle"),
                onClick: () => setAdding(true),
              }
            : undefined
        }
      />
    );
  } else {
    body = (
      <div className={cn("flex flex-col", mobile && "pb-x6")}>
        {groups.map((g, i) => (
          <section key={g.kind} aria-label={kindLabel(g.kind)}>
            {groupHead(g, i === 0)}
            <List>{g.list.map(row)}</List>
          </section>
        ))}
      </div>
    );
  }

  const canAdd = !isLoading && !failed;

  return (
    <>
      {mobile ? (
        body
      ) : (
        <>
          <ManagerHead
            title={ts("sections.recurring.label")}
            description={ts("sections.recurring.desc")}
            actions={
              canAdd ? (
                <Button
                  variant="neutralOutline"
                  size="small"
                  onClick={() => setAdding(true)}
                >
                  <Plus aria-hidden />
                  {t("addTitle")}
                </Button>
              ) : undefined
            }
          />
          <Card body="list">{body}</Card>
        </>
      )}

      {detail && (
        <RecurringDetailDialog
          item={detail}
          categories={categories}
          toggling={toggleMut.isPending}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditing(detail);
            setDetailId(null);
          }}
          onToggle={() => togglePause(detail)}
          // 확인창은 상세 위에 뜬다 — 취소 · 실패하면 상세가 그대로 남고, 지워지면 항목이 사라져 상세도 함께 내려간다
          onDelete={() => setConfirmDelete(detail)}
        />
      )}
      {editing && (
        <RecurringAddDialog
          recurring={editing}
          onClose={() => setEditing(null)}
          onSaved={() => snackbar.show({ message: t("toastSaved") })}
        />
      )}
      {adding && (
        <RecurringAddDialog
          onClose={() => setAdding(false)}
          onCreated={() => snackbar.show({ message: t("toastAdded") })}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("deleteTitle")}
          message={t("deleteMessage", { name: displayTitle(confirmDelete, t) })}
          confirmLabel={tc("delete")}
          danger
          loading={deleteMut.isPending}
          onConfirm={() =>
            deleteMut.mutate(confirmDelete.rowId, {
              onSuccess: () => {
                snackbar.show({
                  message: t("toastDeleted", {
                    name: displayTitle(confirmDelete, t),
                  }),
                });
                setConfirmDelete(null);
                setDetailId(null);
              },
              // 실패는 확인창을 닫은 뒤 스낵바(고정 글 + 다시 시도)로 — 창 위에는 겹치지 않는다
              onError: (error) => {
                const failed = confirmDelete;
                setConfirmDelete(null);
                deleteFailed(failed, error);
              },
            })
          }
          onCancel={() => !deleteMut.isPending && setConfirmDelete(null)}
        />
      )}
    </>
  );
}

/** 불러오는 중 — 묶음 머리 둘 + 줄 넷(타일 40 · 두 줄 · 금액) */
function RecurringSkeleton() {
  return (
    <div aria-hidden className="flex flex-col pb-x6">
      {[0, 1].map((g) => (
        <div key={g}>
          <div
            className={cn(
              "flex justify-between px-global-gutter py-x2",
              g === 0 ? "mt-x2" : "mt-x4",
            )}
          >
            <Skeleton className="h-x4 w-24" />
            <Skeleton className="h-x4 w-32" />
          </div>
          {[0, 1].map((r) => (
            <div
              key={r}
              className="flex items-center gap-x3 px-global-gutter py-x3"
            >
              <Skeleton className="size-x10 rounded-r3" />
              <div className="flex min-w-0 flex-1 flex-col gap-x1_5">
                <Skeleton className="h-x4 w-2/5" />
                <Skeleton className="h-x3 w-3/5" />
              </div>
              <Skeleton className="h-x4 w-20" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
