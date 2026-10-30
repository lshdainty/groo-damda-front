import { useState } from "react";
import { Badge } from "@/shared/ds/badge";
import { CardArt } from "@/shared/ds/image-frame";
import { List, ListSwitchItem } from "@/shared/ds/list";
import { wonPrefix } from "@/shared/lib/groo/format";
import {
  SearchableList,
  SearchableListEmpty,
  SearchableListError,
  SearchableListInput,
  SearchableListItem,
  SearchableListResults,
  SearchableListSkeleton,
} from "@/shared/ds/searchable-list";
import { useCardCatalogs } from "@/features/card-catalog";
import type { CardCatalogSummary, CardType } from "@/entities/card";
import { PICK_LIST, PickResults, PickerField } from "./PickerField";
import type { AssetForm } from "./use-asset-form";

/**
 * 카드 상품 칸(I-17 19) — Input Button → 고르기 시트(1280 이상 팝오버). 서버 검색(마지막 입력 뒤 300ms 에 한 번), 종류(신용 · 체크)는
 * 고른 종류로 거른다. "단종 카드도 보기" 는 검색칸 아래 스위치 줄 — 누르면 목록이 바로 바뀐다. 줄은 카드 그림 56 + 이름 + 설명
 * (발급사 · 종류 · 연회비) + 단종이면 배지(흐리게 두지 않는다).
 */
export function CardProductField({ f }: { f: AssetForm }) {
  const { t, cardType, selectedCard, setSelectedCard, issues, showErrors } = f;
  return (
    <PickerField
      label={t("editDialog.cardProduct")}
      value={selectedCard?.cardName}
      placeholder={t("editDialog.cardPlaceholder")}
      surfaceTitle={t("editDialog.pickCardTitle")}
      invalid={showErrors && issues.card}
      errorMessage={t("editDialog.errCard")}
    >
      {({ close }) => (
        <CardProductList
          t={f.t}
          cardType={cardType}
          selectedId={selectedCard?.rowId}
          onPick={(card) => {
            setSelectedCard(card);
            close();
          }}
        />
      )}
    </PickerField>
  );
}

function CardProductList({
  t,
  cardType,
  selectedId,
  onPick,
}: {
  t: AssetForm["t"];
  cardType: CardType;
  selectedId: number | undefined;
  onPick: (card: CardCatalogSummary) => void;
}) {
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);
  const q = useCardCatalogs({
    keyword: keyword.trim() || undefined,
    cardType,
    includeDiscontinued: includeDiscontinued || undefined,
    page: 0,
    size: 40,
  });
  const items = q.data?.content ?? [];
  return (
    <SearchableList
      value={selectedId != null ? String(selectedId) : undefined}
      onValueChange={(id) => {
        const card = items.find((c) => String(c.rowId) === id);
        if (card) onPick(card);
      }}
      query={typed}
      onQueryChange={setTyped}
      onSearch={setKeyword}
      className={PICK_LIST}
    >
      <SearchableListInput
        placeholder={t("editDialog.cardSearchPlaceholder")}
      />
      {/* 단종 스위치 줄은 검색칸 바로 아래에 고정 — 흐림 스크롤은 결과만(지시서 19) */}
      <List className="shrink-0">
        <ListSwitchItem
          title={t("editDialog.includeDiscontinued")}
          checked={includeDiscontinued}
          onCheckedChange={setIncludeDiscontinued}
        />
      </List>
      <PickResults>
        {q.isError ? (
          <SearchableListError
            retrying={q.isFetching}
            onRetry={() => void q.refetch()}
          />
        ) : q.isLoading ? (
          <SearchableListSkeleton prefix="cardArt" />
        ) : items.length === 0 ? (
          <SearchableListEmpty description={t("editDialog.cardEmptyHint")} />
        ) : (
          <SearchableListResults aria-label={t("editDialog.cardProduct")}>
            {items.map((c) => (
              <SearchableListItem
                key={c.rowId}
                value={String(c.rowId)}
                prefix={
                  <CardArt
                    width={56}
                    issuer={c.company?.name ?? ""}
                    name={c.cardName}
                    src={c.imgUrl}
                  />
                }
                title={c.cardName}
                detail={
                  <span className="flex flex-wrap items-center gap-x1_5">
                    <span>
                      {c.company?.name ?? "—"} ·{" "}
                      {c.cardType === "CREDIT"
                        ? t("cardTypeShort.credit")
                        : t("cardTypeShort.check")}
                      {/* 연회비 정보가 없으면(null) 생략. 0원이면 '무료'로 구분해 보인다. */}
                      {c.annualFee &&
                        (c.annualFee.amount > 0
                          ? ` · ${t("editDialog.annualFeeValue", {
                              amount: `${wonPrefix()}${c.annualFee.amount.toLocaleString("ko-KR")}`,
                            })}`
                          : ` · ${t("editDialog.annualFeeFree")}`)}
                    </span>
                    {c.isDiscontinued === "Y" && (
                      <Badge className="shrink-0">
                        {t("editDialog.discontinued")}
                      </Badge>
                    )}
                  </span>
                }
              />
            ))}
          </SearchableListResults>
        )}
      </PickResults>
    </SearchableList>
  );
}
