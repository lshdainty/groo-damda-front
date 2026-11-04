import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { CardArt } from "@/shared/ds/image-frame";
import { ListButtonItem } from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { decodeHtml } from "@/shared/lib";
import type { CardCatalogSummary } from "@/entities/card";
import {
  annualFeeRowText,
  cardMetaParts,
  performanceRowText,
} from "../model/card-format";

/**
 * 금액 줄(연회비 · 실적) — 금액이 든 항목은 줄이지 않고 항목째 다음 줄로 넘기고, 한 줄보다 길면 쉼표 뒤(<wbr>)에서만 끊는다(tag-group.md · DESIGN 03-D).
 * 두 줄로 갈리면 첫 줄 끝에 구분점이 남지 않게 숨긴다(자리는 그대로 — 숨겼다 펴며 줄이 흔들리지 않게 visibility).
 */
function AmountLine({ fee, perf }: { fee: string; perf: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [wrapped, setWrapped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const [a, b] = [el.children[0], el.children[1]] as HTMLElement[];
      setWrapped(!!a && !!b && b.offsetTop > a.offsetTop);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fee, perf]);
  return (
    <span
      ref={ref}
      className="flex flex-wrap font-sans text-t3 font-normal text-fg-neutral-subtle"
    >
      <span className="whitespace-nowrap">
        {withCommaBreaks(fee)}
        <span
          aria-hidden
          className={
            wrapped ? "invisible text-fg-disabled" : "text-fg-disabled"
          }
        >
          {" ·\u00A0"}
        </span>
        <span className="sr-only">, </span>
      </span>
      <span className="whitespace-nowrap">{withCommaBreaks(perf)}</span>
    </span>
  );
}

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
          <AmountLine
            fee={annualFeeRowText(card, t)}
            perf={performanceRowText(card, t)}
          />
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
