import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { DatePicker, dayKey, parseDayKey } from "@/shared/ds/date-picker";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import {
  ColorPickerRow,
  IconPickerRow,
} from "@/shared/ui/groo/icon-color-rows";
import { i18n } from "@/shared/i18n/config";

/**
 * 저축 목표 폼의 고르는 값 셋 — 목표일 · 아이콘 · 색을 줄로 보이고(I-19 16 ~ 18), 누르면 시트(1280 미만) · 팝오버(이상)로 고른다.
 * 저장 값은 그대로다 — 목표일 "YYYY-MM-DD" 문자열(비면 "") · 아이콘 lucide 이름 · 색 라이트 hex.
 */

// ── 목표일 ───────────────────────────────────────────
export function GoalDeadlineRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation("asset");
  const date = value ? parseDayKey(value) : undefined;
  const [draft, setDraft] = useState<Date | undefined>(date);
  const text = date
    ? new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    : t("savingGoal.none");
  return (
    <PickerRow
      title={t("savingGoal.deadline")}
      value={text}
      surfaceTitle={t("savingGoal.deadline")}
      dismissible={false}
      onClear={date ? () => onChange("") : undefined}
      clearLabel={t("savingGoal.deadlineClear")}
      onOpen={() => setDraft(date)}
      popoverClassName="w-[336px]"
      pickerActions={({ close }) => (
        <Button
          disabled={!draft}
          onClick={() => {
            if (draft) onChange(dayKey(draft));
            close();
          }}
        >
          {t("savingGoal.done")}
        </Button>
      )}
    >
      <DatePicker
        selection="single"
        aria-label={t("savingGoal.deadline")}
        value={draft}
        onValueChange={setDraft}
        autoFocus
      />
    </PickerRow>
  );
}

// ── 아이콘 · 색 — 카테고리 폼과 한 부품(shared/ui/groo/icon-color-rows) ──
export function GoalIconRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation("asset");
  return (
    <IconPickerRow
      title={t("form.icon")}
      value={value}
      onChange={onChange}
      fallbackGlyph={<Target aria-hidden />}
    />
  );
}

export function GoalColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const { t } = useTranslation("asset");
  return (
    <ColorPickerRow title={t("form.color")} value={value} onChange={onChange} />
  );
}
