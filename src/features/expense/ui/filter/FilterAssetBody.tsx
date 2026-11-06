import { useTranslation } from "react-i18next";
import { ListCheckGroup, ListCheckItem } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import type { Asset } from "@/entities/asset";
import type { IncludeExclude } from "../../model/filter";
import { PickModeChips } from "./FilterIncludeExclude";
import { useIncludeExclude } from "./use-include-exclude";

/**
 * 계좌 · 카드 본문 — 먼저 "고른 것만 · 고른 것 빼고", 아래에서 List 체크 줄로 여럿 고른다(앞 로고 타일 40 · 뒤 체크 24 — 줄 어디를
 * 눌러도 바뀐다). 체크는 두 상태뿐이다 — 3상태 체크(✕ 칸)는 두지 않는다(chip.md "빼기").
 */
export function FilterAssetBody({
  assets,
  value,
  onChange,
}: {
  assets: Asset[];
  value: IncludeExclude;
  onChange: (next: IncludeExclude) => void;
}) {
  const { t } = useTranslation("expense");
  const pick = useIncludeExclude(value, onChange);
  return (
    <div className="flex flex-col gap-x3">
      <PickModeChips
        mode={pick.mode}
        onChange={pick.setMode}
        name={t("accountCard")}
      />
      {/* 줄이 제 좌우 24 를 갖는다 — 본문 여백 24 와 겹치지 않게 그 만큼 바깥으로 낸다(목록은 w-full 이라 감싸서 낸다) */}
      <div className="-mx-global-gutter">
        <ListCheckGroup aria-label={t("accountCard")}>
          {assets.map((a) => (
            <ListCheckItem
              key={a.rowId}
              markPosition="suffix"
              // 자산 목록 줄(AssetRow)과 같은 Logo Tile 40 — 기관이 있으면 기관 색, 없으면 이름 색(logo-tile.md)
              prefix={<AssetTile asset={a} />}
              title={a.assetName}
              checked={pick.ids.includes(a.rowId)}
              onCheckedChange={(on) => pick.toggle(a.rowId, on === true)}
            />
          ))}
        </ListCheckGroup>
      </div>
    </div>
  );
}

/** 줄 앞 Logo Tile 40 — 기관 이름은 trim 한 뒤 비면 자산 이름 면, 둘 다 비면 글자 없는 기본 타일(logo-tile.md · 검수 L8) */
function AssetTile({ asset }: { asset: Asset }) {
  const institution = asset.institution?.trim() ?? "";
  return (
    <LogoTile
      name={institution || (asset.assetName?.trim() ?? "")}
      face={institution ? "institution" : "name"}
      size={40}
    />
  );
}
