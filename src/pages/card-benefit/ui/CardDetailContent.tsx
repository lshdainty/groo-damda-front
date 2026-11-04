import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Callout } from "@/shared/ds/callout";
import {
  Accordion,
  AccordionContent,
  AccordionExpandAll,
  AccordionHeader,
  AccordionItem,
  AccordionPlainItem,
  AccordionTrigger,
} from "@/shared/ds/accordion";
import { useDsText } from "@/shared/ds/i18n";
import { CardArt } from "@/shared/ds/image-frame";
import { List, ListItem } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { decodeHtml } from "@/shared/lib";
import { useCardCatalogDetail } from "@/features/card-catalog";
import type { CardCatalogDetail } from "@/entities/card";
import {
  annualFeeDetailText,
  cardMetaParts,
  performanceDetailText,
} from "../model/card-format";

/**
 * 카드 상세 본문 (I-20 E 34) — 조회 시트(1280 미만)와 오른쪽 패널(1280 이상)이 같은 부품 · 같은 차례로 쓴다.
 * 그림 312 가운데 → 카드 이름(t6 · 700 · 줄바꿈) → 설명 "{카드사} · {신용|체크} · {혜택 유형}" → 주요 혜택 태그 한 줄 →
 * 키-값(연회비 · 전월 실적 · 브랜드) → "혜택 n개" + 모두 펼치기 → Accordion separated → 유의사항 Callout.
 * 못 불러오면 그 자리 Result Section failure(서버 원문 없이 고정 글) + [다시 시도].
 */

/** topBenefits[].tags 를 펴서 중복 없이 */
function flattenTopTags(detail: CardCatalogDetail): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of detail.topBenefits) {
    for (const tag of g.tags) {
      const v = decodeHtml(tag);
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

function DetailBody({ detail }: { detail: CardCatalogDetail }) {
  const { t } = useTranslation("card");
  const { t: tAsset } = useTranslation("asset");
  const accId = useId();
  const [values, setValues] = useState<string[]>([]);
  const summary = detail.summary;
  const cardName = decodeHtml(summary.cardName);
  const companyName = decodeHtml(summary.company?.name ?? "");
  const tags = flattenTopTags(detail);
  const brands = detail.brands.map(decodeHtml).filter((b) => b.trim() !== "");
  const benefits = detail.benefits;
  const expandable = benefits
    .filter((b) => decodeHtml(b.detail ?? "").trim() !== "")
    .map((b) => String(b.rowId));
  const cautions = detail.cautions
    .map((c) => decodeHtml(c.detail ?? c.summary ?? c.title ?? c.category))
    .filter((x) => x.trim() !== "");
  return (
    <>
      <div className="flex justify-center pb-x3">
        <CardArt
          width={312}
          issuer={companyName}
          name={cardName}
          src={summary.imgUrl}
        />
      </div>
      <h3 className="m-0 pb-x2 font-sans text-t6 font-bold text-fg-neutral [overflow-wrap:anywhere]">
        {cardName}
      </h3>
      <p className="m-0 pb-x2 font-sans text-t4 font-normal text-fg-neutral-subtle">
        {cardMetaParts(summary, companyName, t, tAsset).join(" · ")}
      </p>
      {tags.length > 0 && (
        <TagGroup
          size="t3"
          className="block pb-x2"
          aria-label={t("benefit.topTagsTitle")}
        >
          {tags.map((tag) => (
            <TagGroupItem key={tag}>{tag}</TagGroupItem>
          ))}
        </TagGroup>
      )}
      <List className="-mx-x6 w-[calc(100%+var(--spacing-x12))]">
        <ListItem
          title={t("benefit.statAnnualFee")}
          suffixText
          suffix={annualFeeDetailText(summary, t)}
        />
        <ListItem
          title={t("benefit.statPerformance")}
          suffixText
          suffix={performanceDetailText(summary, t)}
        />
        {brands.length > 0 && (
          <ListItem
            title={t("benefit.brands")}
            suffixText
            suffix={brands.join(" · ")}
          />
        )}
      </List>

      <AccordionHeader
        className="pt-x2"
        title={t("benefit.detailCount", { count: benefits.length })}
      >
        {expandable.length > 0 && (
          <AccordionExpandAll
            controls={accId}
            values={values}
            expandable={expandable}
            onValuesChange={setValues}
            expandLabel={t("benefit.expandAll")}
            collapseLabel={t("benefit.collapseAll")}
          />
        )}
      </AccordionHeader>
      {benefits.length === 0 ? (
        <p className="m-0 py-x6 text-center font-sans text-t4 font-normal text-fg-neutral-subtle">
          {t("benefit.noBenefits")}
        </p>
      ) : (
        <Accordion
          id={accId}
          variant="separated"
          values={values}
          onValuesChange={setValues}
        >
          {benefits.map((b) => {
            const title = decodeHtml(b.category);
            const description = decodeHtml(b.summary ?? b.title ?? "");
            const body = decodeHtml(b.detail ?? "");
            return body.trim() !== "" ? (
              <AccordionItem key={b.rowId} value={String(b.rowId)}>
                <AccordionTrigger
                  title={title}
                  description={description || undefined}
                />
                <AccordionContent>{body}</AccordionContent>
              </AccordionItem>
            ) : (
              <AccordionPlainItem
                key={b.rowId}
                title={title}
                description={description || undefined}
              />
            );
          })}
        </Accordion>
      )}

      {cautions.length > 0 && (
        <>
          <h3 className="m-0 pb-x2 pt-x6 font-sans text-t4 font-bold text-fg-neutral">
            {t("benefit.cautions")}
          </h3>
          <Callout tone="informative">
            {cautions.map((c, i) => (
              <span
                key={i}
                className={i > 0 ? "mt-x2 block" : "block"}
                style={{ whiteSpace: "pre-line" }}
              >
                {c}
              </span>
            ))}
          </Callout>
        </>
      )}
    </>
  );
}

/** 불러오는 동안 — 그림 312 · 이름 · 설명 · 키-값 셋 · 혜택 머리 + 항목 셋 (실제 차례와 같다) */
export function DetailSkeleton() {
  return (
    <div aria-busy="true">
      <div className="flex justify-center pb-x3">
        <Skeleton className="aspect-[1.586] w-[312px] max-w-full" radius="8" />
      </div>
      <Skeleton text="t6" className="mb-x2 w-2/3" />
      <Skeleton text="t4" className="mb-x4 w-1/2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between py-x3">
          <Skeleton text="t5" className="w-16" />
          <Skeleton text="t5" className="w-24" />
        </div>
      ))}
      <Skeleton text="t4" className="my-x4 w-24" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="mb-x2 h-[74px] w-full" radius="16" />
      ))}
    </div>
  );
}

export function CardDetailContent({ rowId }: { rowId: number }) {
  const { t } = useTranslation("card");
  const dsT = useDsText();
  const q = useCardCatalogDetail(rowId, { silent: true });
  if (q.isLoading) return <DetailSkeleton />;
  // 보이던 상세가 있으면 재요청 실패로 지우지 않는다 — 값이 없을 때만 실패 화면
  if (!q.data) {
    return (
      <ResultSection
        size="medium"
        kind="failure"
        title={t("benefit.loadFail")}
        description={t("benefit.failDesc")}
        primaryAction={{
          label: dsT("common.retry"),
          onClick: () => void q.refetch(),
        }}
      />
    );
  }
  return <DetailBody key={rowId} detail={q.data} />;
}
