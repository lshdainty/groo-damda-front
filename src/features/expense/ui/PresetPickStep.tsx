import { useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/shared/ds/input";
import { List } from "@/shared/ds/list";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";
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
}: {
  /** 지금 종류의 프리셋 전부 */
  presets: ExpenseTemplate[];
  categories: ExpenseCategory[];
  onPick: (preset: ExpenseTemplate) => void;
}) {
  const { t } = useTranslation("expense");
  const [query, setQuery] = useState("");
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
