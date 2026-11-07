import {
  ArrowRightLeft,
  EllipsisVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { useWideSurface } from "@/shared/ds/overlay";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { List, ListHeader, ListItem, ListTile } from "@/shared/ds/list";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { Icon } from "@/shared/ui/groo/primitives";
import { cn } from "@/shared/lib/cn";
import { isIconName } from "@/shared/lib";
import { money } from "@/shared/lib/groo/format";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import type { ExpenseCategory } from "@/entities/expense";
import type { RecurringTransaction } from "@/entities/recurring-transaction";
import {
  displayTitle,
  endSentence,
  cycleSentence,
  nextDateText,
  nextMoment,
  recurringAmountTone,
} from "../lib/recurring-format";
import { isFinished, upcomingDates } from "../lib/recurring-schedule";

const PAYMENT_KEYS: Record<string, string> = {
  CASH: "form.paymentMethod.CASH",
  CARD: "form.paymentMethod.CARD",
  TRANSFER: "paymentTransferFull",
  OTHER: "form.paymentMethod.OTHER",
};

/**
 * 반복 거래 상세(I-20 D 24 · 25) — 조회 시트(1280 미만) · 대화상자 480. 머리(타일 48 + 이름 + 금액) → 주기를 문장으로 → 키-값 줄 →
 * "다음 예정일". 바닥은 [일시정지](쉬는 중이면 [다시 켜기]) + [수정]. 삭제는 줄에 ⋮ 를 두지 않는 대신 머리 오른쪽 ⋮ 메뉴에 있다.
 * 일시정지 · 다시 켜기는 상세가 열린 채 새 값으로 다시 그린다(부르는 쪽이 `item` 을 갱신된 값으로 준다).
 */
export function RecurringDetailDialog({
  item,
  categories,
  onClose,
  onEdit,
  onToggle,
  onDelete,
  toggling = false,
}: {
  item: RecurringTransaction;
  categories: ExpenseCategory[];
  /** 예전 껍데기가 폰 · 데스크톱을 가르던 값 — 표면이 1280 에서 스스로 가른다(받기만 한다) */
  mobile?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  /** 일시정지 · 다시 켜기 요청 중 */
  toggling?: boolean;
}) {
  const { t } = useTranslation("recurring");
  const { t: te } = useTranslation("expense");
  const { t: tc } = useTranslation("common");

  const wide = useWideSurface();
  const tone = recurringAmountTone(item);
  const isTransfer = item.expenseType === "TRANSFER";
  const finished = isFinished(item);
  // 끝남은 서버가 isActive 를 N 으로 바꿔도 "쉬는 중" 이 아니다(isFinished 가 먼저)
  const isActive = item.isActive === "Y" && !finished;
  const cat = categories.find((c) => c.rowId === item.categoryRowId);
  const palette = getPaletteByColor(cat?.color);
  const name = displayTitle(item, t);

  const dates = upcomingDates(
    item,
    item.nextExecutionDate,
    item.executedCount,
    3,
    isActive && !finished,
  );

  const cycle = cycleSentence(item, t);

  const rows: { key: string; name: string; value: string }[] = [];
  const add = (key: string, label: string, value?: string | null) => {
    if (value != null && value !== "") rows.push({ key, name: label, value });
  };
  const yesNo = (on: boolean) => (on ? t("on") : t("off"));
  if (isTransfer) {
    add("from", te("addTx.fromAccount"), item.assetName);
    add("to", te("preset.toAccount"), item.toAssetName);
    add("fee", t("feeRow"), item.fee ? money(item.fee) : null);
    add(
      "interest",
      t("interestRow"),
      item.interestAmount ? money(item.interestAmount) : null,
    );
  } else {
    add("cat", te("category"), item.categoryName);
    add(
      "asset",
      item.expenseType === "INCOME"
        ? te("addTx.depositAccount")
        : te("accountCard"),
      item.assetName,
    );
    add(
      "pay",
      item.expenseType === "INCOME"
        ? te("addTx.incomeMethod")
        : te("paymentMethodLabel"),
      item.paymentMethod
        ? PAYMENT_KEYS[item.paymentMethod]
          ? te(PAYMENT_KEYS[item.paymentMethod]!)
          : item.paymentMethod
        : null,
    );
  }
  add("memo", te("memo"), item.description);
  rows.push({
    key: "auto",
    name: t("autoLog"),
    value: item.autoLog
      ? t("onWithCount", { count: item.executedCount })
      : t("off"),
  });
  rows.push({
    key: "notify",
    name: t("notifyDayBefore"),
    value: yesNo(item.notifyDayBefore),
  });
  if (!isTransfer) {
    rows.push({
      key: "fixed",
      name: t(item.expenseType === "INCOME" ? "fixed.income" : "fixed.expense"),
      value: yesNo(!!item.isFixed),
    });
  }

  const footer = (
    <ResponsiveDialogFooter>
      {/* 끝난 반복은 일시정지 · 다시 켜기가 뜻이 없다(채운 횟수 · 지난 끝 날짜) — 수정만 */}
      {!finished && (
        <Button
          variant="neutralWeak"
          loading={toggling}
          onClick={onToggle}
          className="flex-1 lg:flex-none"
        >
          {isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
          {isActive ? t("pause") : t("resume")}
        </Button>
      )}
      <Button
        variant="neutralSolid"
        onClick={onEdit}
        className="flex-1 lg:flex-none"
      >
        {tc("edit")}
      </Button>
    </ResponsiveDialogFooter>
  );

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={t("detailTitle")}
        aria-describedby={undefined}
        headerAction={
          <ResponsiveMenu>
            <ResponsiveMenuTrigger asChild>
              <Button
                variant="ghost"
                ghostColor="neutralSubtle"
                layout="iconOnly"
                size="small"
                aria-label={t("moreOf", { name })}
              >
                <EllipsisVertical aria-hidden />
              </Button>
            </ResponsiveMenuTrigger>
            <ResponsiveMenuContent title={name} align="end">
              <ResponsiveMenuGroup>
                <ResponsiveMenuItem
                  label={tc("edit")}
                  icon={<Pencil aria-hidden />}
                  onSelect={onEdit}
                />
                {!finished && (
                  <ResponsiveMenuItem
                    label={isActive ? t("pause") : t("resume")}
                    icon={
                      isActive ? <Pause aria-hidden /> : <Play aria-hidden />
                    }
                    onSelect={onToggle}
                  />
                )}
              </ResponsiveMenuGroup>
              <ResponsiveMenuGroup>
                <ResponsiveMenuItem
                  label={tc("delete")}
                  icon={<Trash2 aria-hidden />}
                  tone="critical"
                  onSelect={onDelete}
                />
              </ResponsiveMenuGroup>
            </ResponsiveMenuContent>
          </ResponsiveMenu>
        }
      >
        <ResponsiveDialogBody scrollFog>
          <div className="-mx-x6">
            {/* 머리 — 타일 48 + 이름(t7 · 700, 줄바꿈) */}
            <div className="flex items-center gap-x3 px-global-gutter pb-x2 pt-x4">
              <ListTile
                className={cn(
                  "size-x12 rounded-r4 [&>svg]:size-x6",
                  isTransfer && "bg-bg-neutral-weak text-fg-neutral",
                )}
                style={
                  isTransfer
                    ? undefined
                    : { background: palette.bg, color: palette.color }
                }
              >
                {isTransfer ? (
                  <ArrowRightLeft aria-hidden />
                ) : (
                  <Icon
                    name={cat && isIconName(cat.icon) ? cat.icon : "tag"}
                    size={24}
                  />
                )}
              </ListTile>
              <h3 className="m-0 min-w-0 break-words font-sans text-t7 font-bold text-fg-neutral">
                {name}
              </h3>
            </div>
            {/* 금액 — 위 12 · 아래 4, t9 · 700 */}
            <p
              className={cn(
                "m-0 break-words px-global-gutter pb-x1 pt-x3 font-sans text-t9 font-bold tabular-nums",
                tone.className,
              )}
            >
              <MaskAmount card="etc.recurring">
                {tone.sign}
                {money(Math.abs(item.amount))}
              </MaskAmount>
            </p>
            {/* 주기를 문장으로 — 위 4 · 아래 8 */}
            <p
              data-slot="recurring-sentence"
              className="m-0 px-global-gutter pb-x2 pt-x1 font-sans text-t5 text-fg-neutral"
            >
              {finished ? (
                t("sentenceFinished")
              ) : !isActive ? (
                <Trans
                  t={t}
                  i18nKey="sentencePaused"
                  components={{ b: <strong className="font-bold" /> }}
                />
              ) : (
                <>
                  {t("sentenceLead", { cycle, end: endSentence(item, t) })}{" "}
                  <Trans
                    t={t}
                    i18nKey="sentenceNext"
                    values={{ next: nextMoment(item) }}
                    components={{ b: <strong className="font-bold" /> }}
                  />
                </>
              )}
            </p>
            <List aria-label={t("detailTitle")} className="pt-x1">
              {rows.map((r) => (
                <ListItem
                  key={r.key}
                  title={r.name}
                  suffixText
                  suffix={
                    <span className="text-end font-bold tabular-nums text-fg-neutral">
                      {r.value}
                    </span>
                  }
                />
              ))}
            </List>
            {dates.length > 0 && (
              <>
                <ListHeader as="div" variant="boldSolid" className="mt-x2">
                  <h4>{t("nextDatesTitle")}</h4>
                </ListHeader>
                <p
                  data-slot="recurring-next-dates"
                  className="m-0 flex flex-wrap gap-x-x4 gap-y-x1 px-global-gutter pb-x2 font-sans text-t4 tabular-nums text-fg-neutral-muted"
                >
                  {dates.map((d) => (
                    <span key={d}>{nextDateText(d)}</span>
                  ))}
                </p>
              </>
            )}
          </div>
        </ResponsiveDialogBody>
        {/* 시트(1280 미만)는 바닥에 붙어 있어 스낵바가 [다시 켜기] 를 덮는다 — 띠가 바닥 버튼 위 8 에 서게 한다(snackbar.md 피할 자리). 대화상자는 화면 가운데라 겹치지 않는다 */}
        {wide ? footer : <SnackbarAvoidOverlap>{footer}</SnackbarAvoidOverlap>}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
