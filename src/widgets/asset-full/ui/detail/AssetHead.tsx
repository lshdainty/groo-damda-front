import { LogoTile } from "@/shared/ds/logo-tile";
import type { Asset } from "@/entities/asset";
import { useAssetDescription } from "./use-asset-detail";

/** 자산 로고(Logo Tile 48 — 기관이 있으면 기관 색, 없으면 이름 색) */
export function AssetLogo48({ asset }: { asset: Asset }) {
  return (
    <LogoTile
      name={asset.institution || asset.assetName}
      face={asset.institution ? "institution" : "name"}
      size={48}
    />
  );
}

/**
 * 폰 머리(I-17 45) — Logo Tile 48 + 오른쪽 12 + 이름 t6 · 700 줄바꿈 + 설명 t3 · subtle. 위 16 · 좌우 24 · 아래 8.
 * 데스크톱 · 태블릿은 이 자리가 제목 줄(PageHead)이라 쓰지 않는다.
 */
export function AssetHead({ asset }: { asset: Asset }) {
  const desc = useAssetDescription(asset);
  return (
    <div
      data-slot="asset-detail-head"
      className="flex items-center gap-x3 px-global-gutter pb-x2 pt-x4"
    >
      <span className="shrink-0">
        <AssetLogo48 asset={asset} />
      </span>
      <div className="min-w-0">
        <p className="m-0 break-words text-t6 font-bold text-fg-neutral">
          {asset.assetName}
        </p>
        {desc && (
          <p className="m-0 break-words text-t3 text-fg-neutral-subtle">
            {desc}
          </p>
        )}
      </div>
    </div>
  );
}
