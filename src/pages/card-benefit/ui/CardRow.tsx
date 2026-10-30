import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { CardArt } from "@/shared/ds/image-frame";
import { ListButtonItem } from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { decodeHtml } from "@/shared/lib";
import type { CardCatalogSummary } from "@/entities/card";
import {
  annualFeeRowText,
  cardMetaParts,
  performanceRowText,
} from "../model/card-format";

/**
 * 카드 줄 (I-20 E 32) — ds List 누르는 줄 + 앞 카드 그림 56, 위 맞춤. 제목은 카드 이름(줄바꿈, 말줄임 없음),
 * 설명 두 줄은 Tag Group t3 로 줄마다 한 줄 말줄임: "{카드사} · {신용|체크} · {혜택 유형}" / "{연회비} · {실적}".
 * 단종은 흐리지 않고 뒤 Badge `weak` `neutral` "단종". 줄을 누르면 시트(1280 미만) 또는 오른쪽 패널(1280 이상)이 바뀐다 — 화살표 없음.
 * 고른 줄(`picked`)은 `bg-neutral-weak-pressed` + `aria-current` (패널이 보여 주는 카드).
 */
export function CardRow({
  card,
  picked = false,
  onClick,
}: {
  card: CardCatalogSummary;
  picked?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("card");
  const { t: tAsset } = useTranslation("asset");
  const cardName = decodeHtml(card.cardName);
  const companyName = decodeHtml(card.company?.name ?? "");
  const discontinued = card.isDiscontinued === "Y";
  return (
    <ListButtonItem
      align="top"
      onClick={onClick}
      aria-current={picked ? "true" : undefined}
      rootProps={
        picked
          ? {
              // 고른 줄 바탕은 한 겹 — 줄 전체 띠. 올림 · 누름의 둥근 안쪽 바탕(list-background)은 이 줄에서 끈다
              className:
                "bg-bg-neutral-weak-pressed [&>[data-slot=list-background]]:bg-transparent!",
            }
          : undefined
      }
      prefix={
        <CardArt
          width={56}
          issuer={companyName}
          name={cardName}
          src={card.imgUrl}
        />
      }
      title={cardName}
      detail={
        <>
          <span className="flex min-w-0">
            <TagGroup size="t3" truncate>
              {cardMetaParts(card, companyName, t, tAsset).map((x) => (
                <TagGroupItem key={x}>{x}</TagGroupItem>
              ))}
            </TagGroup>
          </span>
          {/* 금액 항목(연회비 · 실적)은 줄이지 않고 통째로 다음 줄로 넘긴다 — 말줄임으로 금액이 사라지지 않게 */}
          <span className="block min-w-0">
            <TagGroup size="t3">
              <TagGroupItem className="whitespace-nowrap">
                {annualFeeRowText(card, t)}
              </TagGroupItem>
              <TagGroupItem className="whitespace-nowrap">
                {performanceRowText(card, t)}
              </TagGroupItem>
            </TagGroup>
          </span>
        </>
      }
      suffix={
        discontinued ? (
          <Badge variant="weak" tone="neutral">
            {tAsset("editDialog.discontinued")}
          </Badge>
        ) : undefined
      }
    />
  );
}
