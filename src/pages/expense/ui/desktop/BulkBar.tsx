import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { useDsText } from "@/shared/ds/i18n";
import { KRW, plusOf } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";

/**
 * 일괄 작업 바 (I-07 34 · ④A) — 하나 이상 골랐을 때만 목록 카드 맨 위에. 값은 table.yaml `bulkBar`(최소 48 · 왼쪽 16 · 오른쪽 8 ·
 * 모서리 12 · bg-brand-weak · 사이 8) 그대로이고, 이 화면만 "합계" 글 자리를 더한다 — 표의 `TableBulkBar` 는 자식이 오른쪽 묶음에만
 * 들어가 합계 자리가 없어서 같은 값으로 따로 짠다. 좁아지면(큰 글자 · 768) 합계가 수 아래 줄로 내려가고 동작은 오른쪽에 남는다.
 * ✕ = 고른 것 모두 풀기(모드는 [완료] 로 끝난다).
 */
export function BulkBar({
  count,
  sum,
  overLimit,
  busy,
  onMarkFixed,
  onDelete,
  onClear,
}: {
  count: number;
  /** 고른 줄의 수입 − 지출 */
  sum: number;
  /** 한 번에 처리할 수 있는 건수(500)를 넘었다 */
  overLimit: boolean;
  /** 고정 표시 요청 중 */
  busy: boolean;
  onMarkFixed: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("expense");
  const dsT = useDsText();
  const message = count > 0 ? dsT("table.selectedCount", { count }) : "";
  return (
    <>
      {count > 0 && (
        <div
          role="group"
          aria-label={dsT("table.bulkBar")}
          data-slot="expense-bulk-bar"
          className="mx-x3 mt-x3 flex min-h-[48px] flex-wrap items-center gap-x2 rounded-r3 bg-bg-brand-weak pl-x4 pr-x2 font-sans"
        >
          <span aria-hidden className="text-t4 font-medium text-fg-neutral">
            {message}
          </span>
          <span className="num min-w-0 flex-1 whitespace-nowrap text-t4 text-fg-neutral">
            {t("bulk.sum")}{" "}
            <b className="font-bold">
              <MaskAmount card="ledger.txList" kind="net" mask="••••">
                {plusOf(sum)}
                {wonPre()}
                {KRW(Math.abs(sum))}
              </MaskAmount>
              <WonUnit card="ledger.txList" kind="net" />
            </b>
          </span>
          {overLimit && (
            <span className="basis-full text-t2 text-fg-neutral-subtle">
              {t("bulk.limit")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-x2">
            <Button
              variant="ghost"
              size="small"
              disabled={overLimit}
              loading={busy}
              onClick={onMarkFixed}
            >
              {t("bulk.markFixed")}
            </Button>
            <Button
              variant="ghost"
              size="small"
              disabled={overLimit}
              onClick={onDelete}
            >
              {t("bulk.delete")}
            </Button>
            <Button
              variant="ghost"
              size="small"
              layout="iconOnly"
              aria-label={dsT("table.clearSelection")}
              onClick={onClear}
            >
              <X />
            </Button>
          </div>
        </div>
      )}
      {/* 고른 수 — 바가 없을 때도 자리를 두어야 처음 고를 때 읽힌다 */}
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
