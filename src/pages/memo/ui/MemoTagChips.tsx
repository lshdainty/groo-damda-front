import { useTranslation } from "react-i18next";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { cn } from "@/shared/lib/cn";
import { NO_TAG_KEY } from "../lib/memo-tags";
import type { MemoScreen } from "../model/use-memo-screen";

/**
 * 태그 칩 줄(I-15 8) — 하나 고르기 · 가로로 밀림. 폰 화면과 768 ~ 1279 한 카드가 같은 부품 · 같은 상태(`tagFilter`)를 쓴다.
 * 차례는 전체 → 설정 태그 → 남은 이름 → 태그 없음, 건수는 늘 전체 기준.
 */
export function MemoTagChips({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const { memos, tagFilter, setTagFilter, chips } = screen;
  const count = (n: number, on: boolean) => (
    <span
      className={cn(
        "ml-x1 tabular-nums",
        on ? "text-fg-neutral-inverted" : "text-fg-neutral-subtle",
      )}
    >
      {n}
    </span>
  );
  return (
    <ChipRadioGroup
      layout="scroll"
      aria-label={t("tagFilter")}
      value={tagFilter}
      onValueChange={setTagFilter}
    >
      <ChipRadio value="all" variant="outlineStrong" size="small">
        {t("all")}
        {count(memos.length, tagFilter === "all")}
      </ChipRadio>
      {chips.map((c) => (
        <ChipRadio
          key={c.key}
          value={c.key}
          variant="outlineStrong"
          size="small"
        >
          {c.key === NO_TAG_KEY ? t("noTag") : c.key}
          {count(c.count, tagFilter === c.key)}
        </ChipRadio>
      ))}
    </ChipRadioGroup>
  );
}
