import { useRef, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { Chip, ChipGroup, type ChipSize } from "@/shared/ds/chip";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { PickList } from "@/shared/ui/groo/pick-list";
import {
  BENEFIT_FILTER_KEYS,
  TYPE_FILTER_KEYS,
  type BenefitFilterKey,
  type TypeFilterKey,
} from "../model/card-format";

/**
 * 거르기 칩 줄 — 필터 바 (I-20 E 31 · I-07 28). 칩 둘 "카드 종류 ▾" · "혜택 ▾", 누르면 그 조건 하나만 열고 줄 하나를 누르면 바로 고른다.
 * 1280 이상 칩 small 32 + Popover, 미만 medium 36 + Bottom Sheet(폰 가로 스크롤 + 끝 흐림). 걸린 조건은 짙은 채움 + 값("신용" · "적립"),
 * 하나라도 걸리면 맨 앞에 ↺(모두 지움). "캐시백" 칩은 없다 — 서버 혜택 유형은 할인 · 적립 · 마일리지 셋이다.
 */

function ChoiceChip({
  chipLabel,
  active,
  title,
  size,
  wide,
  items,
  selected,
  onPick,
}: {
  chipLabel: string;
  active: boolean;
  title: string;
  size: ChipSize;
  wide: boolean;
  items: { value: string; title: string }[];
  selected: string;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const own = useRef<HTMLButtonElement | null>(null);
  const chip = (
    <Chip
      ref={own}
      variant="solid"
      size={size}
      selected={active}
      className="max-w-full"
      suffixIcon={<ChevronDown />}
      aria-haspopup="dialog"
      onClick={wide ? undefined : () => setOpen(true)}
    >
      {chipLabel}
    </Chip>
  );
  const list = (
    <PickList
      label={title}
      items={items}
      selected={selected}
      onPick={(value) => {
        onPick(value);
        setOpen(false);
        if (!wide) requestAnimationFrame(() => own.current?.focus());
      }}
    />
  );
  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{chip}</PopoverTrigger>
        <PopoverContent title={title} align="start" className="w-[280px]">
          <PopoverBody>{list}</PopoverBody>
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {chip}
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent title={title} aria-describedby={undefined}>
          <BottomSheetBody scrollFog>{list}</BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

export function CardFilterBar({
  type,
  benefit,
  onType,
  onBenefit,
  wide,
}: {
  type: TypeFilterKey;
  benefit: BenefitFilterKey;
  onType: (next: TypeFilterKey) => void;
  onBenefit: (next: BenefitFilterKey) => void;
  /** 1280 이상 — 칩 small 32 · 팝오버. 미만은 medium 36 · 시트 */
  wide: boolean;
}) {
  const { t } = useTranslation("card");
  const { t: tAsset } = useTranslation("asset");
  const size: ChipSize = wide ? "small" : "medium";
  const typeName = (k: TypeFilterKey) =>
    k === "all"
      ? t("benefit.typeAll")
      : k === "CREDIT"
        ? tAsset("cardTypeShort.credit")
        : tAsset("cardTypeShort.check");
  const benefitName = (k: BenefitFilterKey) =>
    k === "all"
      ? t("benefit.typeAll")
      : t(
          k === "DISCOUNT"
            ? "benefitType.discount"
            : k === "POINT"
              ? "benefitType.point"
              : "benefitType.mileage",
        );
  const active = type !== "all" || benefit !== "all";
  return (
    <ChipGroup
      layout="scroll"
      bleed
      role="group"
      aria-label={t("benefit.filterBar")}
    >
      {active && (
        <Chip
          variant="outlineStrong"
          size={size}
          layout="iconOnly"
          aria-label={t("benefit.filterClear")}
          onClick={() => {
            onType("all");
            onBenefit("all");
          }}
        >
          <RotateCcw />
        </Chip>
      )}
      <ChoiceChip
        chipLabel={type === "all" ? t("benefit.typeChip") : typeName(type)}
        active={type !== "all"}
        title={t("benefit.typeChip")}
        size={size}
        wide={wide}
        items={TYPE_FILTER_KEYS.map((k) => ({
          value: k,
          title: typeName(k),
        }))}
        selected={type}
        onPick={(v) => onType(v as TypeFilterKey)}
      />
      <ChoiceChip
        chipLabel={
          benefit === "all" ? t("benefit.benefitChip") : benefitName(benefit)
        }
        active={benefit !== "all"}
        title={t("benefit.benefitChip")}
        size={size}
        wide={wide}
        items={BENEFIT_FILTER_KEYS.map((k) => ({
          value: k,
          title: benefitName(k),
        }))}
        selected={benefit}
        onPick={(v) => onBenefit(v as BenefitFilterKey)}
      />
    </ChipGroup>
  );
}
