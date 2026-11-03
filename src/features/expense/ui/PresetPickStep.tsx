import { useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/shared/ds/input";
import { Skeleton } from "@/shared/ds/skeleton";
import { List } from "@/shared/ds/list";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { PresetListRow } from "./preset-row";

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 내역 추가 시트의 "프리셋 고르기" 한 단계(I-20 C 20) — 밑줄 검색칸(이름 · 기본 내역에서 찾는다) + 지금 종류의 프리셋 모두
 * (사용 많은 순). 줄은 프리셋 관리 목록과 같은 부품이다. 줄을 누르면 `onPick` 으로 채우고 내역 단계로 돌아간다.
 */
export function PresetPickStep({
  presets,
  categories,
  onPick,
  failed = false,
  loading = false,
  onRetry,
}: {
  /** 지금 종류의 프리셋 전부 */
  presets: ExpenseTemplate[];
  categories: ExpenseCategory[];
  onPick: (preset: ExpenseTemplate) => void;
  /** 카테고리 조회가 실패했다 — 줄 타일이 "없는 카테고리" 로 읽히지 않게 실패 Result Section + 다시 시도 */
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("expense");
  const [query, setQuery] = useState("");
  if (failed) {
    return (
      <BandFailure
        title={t("preset.categoryLoadFailed")}
        onRetry={() => onRetry?.()}
      />
    );
  }
  if (loading) {
    return (
      <div aria-hidden className="flex flex-col gap-x3 px-global-gutter py-x3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} text="t5" className="w-1/2" />
        ))}
      </div>
    );
  }
  const q = norm(query);
  const shown = presets
    .filter(
      (p) =>
        q === "" ||
        norm(p.templateName).includes(q) ||
        norm(p.merchant ?? "").includes(q),
    )
    .sort((a, b) => b.useCount - a.useCount);
  return (
    <div className="-mx-x6">
      <div className="px-global-gutter pb-x2 pt-x2">
        <Input
          variant="underline"
          size="large"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("addTx.presetSearch")}
          aria-label={t("addTx.presetSearch")}
          prefixIcon={<Search />}
          clearable
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {shown.length === 0 ? (
        <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
          {t("addTx.presetNoResult")}
        </p>
      ) : (
        <List aria-label={t("addTx.presetPickTitle")}>
          {shown.map((p) => (
            <PresetListRow
              key={p.rowId}
              preset={p}
              category={
                p.categoryRowId != null
                  ? categories.find((c) => c.rowId === p.categoryRowId)
                  : undefined
              }
              onClick={() => onPick(p)}
            />
          ))}
        </List>
      )}
    </div>
  );
}
