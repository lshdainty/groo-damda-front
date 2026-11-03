import { useRef, useState } from "react";
import { DynamicIcon } from "lucide-react/dynamic";
import { Tag } from "lucide-react";
import { ColorSwatchGroup, colorName } from "@/shared/ds/color-swatch";
import type { ColorSwatchValue } from "@/shared/ds/color-swatch";
import { useDsText } from "@/shared/ds/i18n";
import {
  CATEGORY_ICON_GLYPHS,
  DEFAULT_CATEGORY_ICON,
  IconPickerPanel,
  findCategoryIcon,
} from "@/shared/ds/icon-picker";
import {
  cellsOf,
  centerInScroller,
} from "@/shared/ds/icon-picker/icon-picker-variants";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { isIconName } from "@/shared/lib";
import { CHART_PAIRS, chartColorOf } from "@/shared/lib/groo/chart-palette";

/**
 * 폼 안의 아이콘 줄 · 색 줄 — 저축 목표(I-19 17 · 18)와 카테고리(I-20 B 12)가 한 부품으로 쓴다.
 * 저장 값은 그대로다 — 아이콘은 lucide 이름, 색은 라이트 hex(DB 에 저장된 base 값).
 */

function Glyph({ id, fallback }: { id: string; fallback: React.ReactNode }) {
  const entry = findCategoryIcon(id);
  const Known = entry ? CATEGORY_ICON_GLYPHS[entry.id] : undefined;
  if (Known) return <Known aria-hidden />;
  if (isIconName(id)) return <DynamicIcon aria-hidden name={id} />;
  return <>{fallback}</>;
}

/** 아이콘 줄 → Icon Picker 패널(시트 6열 · 팝오버 408). 세트 밖 저장 아이콘은 "지금 아이콘" 으로 보이고 고르지 않으면 바뀌지 않는다 */
export function IconPickerRow({
  title,
  prefix,
  value,
  onChange,
  fallbackGlyph = <Tag aria-hidden />,
}: {
  title: string;
  /** 줄 앞 아이콘 22 */
  prefix?: React.ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** 이름을 그릴 수 없는 저장 값일 때 줄 값 앞에 놓을 그림 */
  fallbackGlyph?: React.ReactNode;
}) {
  const dsT = useDsText();
  const surface = useInputButtonSurface();
  const [query, setQuery] = useState("");
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const stored = value.trim();
  const entry = findCategoryIcon(stored);
  const shownId = entry ? entry.id : stored || DEFAULT_CATEGORY_ICON;
  const name = entry ? entry.name : dsT("iconPicker.current");
  const selectedId = entry ? entry.id : null;

  const onOpenAutoFocus = (e: Event) => {
    e.preventDefault();
    const cells = cellsOf(listboxRef.current);
    const cell =
      cells.find((c) => c.getAttribute("data-icon") === selectedId) ?? cells[0];
    if (!cell) return;
    centerInScroller(cell);
    cell.focus({ preventScroll: true });
  };

  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={name}
      glyph={<Glyph id={shownId} fallback={fallbackGlyph} />}
      surfaceTitle={dsT("iconPicker.label")}
      bodyless
      popoverClassName="w-[408px]"
      onOpenAutoFocus={onOpenAutoFocus}
      onOpen={() => setQuery("")}
    >
      {({ close }) => (
        <IconPickerPanel
          surface={surface}
          selectedId={selectedId}
          query={query}
          onQueryChange={setQuery}
          onSelect={(id) => {
            onChange(id);
            close();
          }}
          listboxRef={listboxRef}
          searchRef={searchRef}
        />
      )}
    </PickerRow>
  );
}

const BASE_OF = Object.fromEntries(CHART_PAIRS.map((p) => [p.key, p.base]));

/** 색 줄 → Color Swatch(원 40 · 5 × 2). 팔레트 밖 저장 색은 "지금 색" 칸이 골라져 열리고 고르지 않으면 바꾸지 않는다 */
export function ColorPickerRow({
  title,
  prefix,
  value,
  onChange,
}: {
  title: string;
  /** 줄 앞 아이콘 22 */
  prefix?: React.ReactNode;
  value: string;
  onChange: (hex: string) => void;
}) {
  const dsT = useDsText();
  // 처음 열 때 저장된 색 — 팔레트 밖이면 "지금 색" 칸을 끝까지 둔다(격자 색을 골라도 사라지지 않고, 다시 고르면 저장 값 그대로)
  const [stored] = useState(value);
  const storedOutside = chartColorOf(stored) == null;
  const key = chartColorOf(value);
  const selected: ColorSwatchValue = key ?? "current";
  const name = key ? colorName(key) : dsT("colorSwatch.currentCustom");
  const dot = key ? `var(--color-chart-${key})` : value;
  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={name}
      dot={dot}
      dotSize={12}
      surfaceTitle={title}
      popoverClassName="w-fit"
    >
      {({ close }) => (
        <div className="pt-x1">
          <ColorSwatchGroup
            aria-label={title}
            value={selected}
            currentColor={storedOutside ? stored : undefined}
            onValueChange={(v) => {
              // "지금 색" 칸을 고르면 저장 값으로 되돌린다 — 몰래 바꾸지 않는다
              onChange(v === "current" ? stored : BASE_OF[v]!);
              close();
            }}
          />
        </div>
      )}
    </PickerRow>
  );
}
