import { useTranslation } from "react-i18next";
import { SearchX, Users } from "lucide-react";
import { Avatar, AvatarStack } from "@/shared/ds/avatar";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import { ProgressBar } from "@/shared/ds/progress";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import type { DutchPay } from "@/entities/dutch-pay";
import { dutchDate, friendsOf, paidCountOf } from "../model/dutch-model";
import { PerPersonText, Won } from "./dutch-parts";
import { perPersonOfSession } from "../model/dutch-model";

export type TabKey = "active" | "past" | "friends";

/**
 * 정산 줄(I-15 28) — ds List 누르는 줄: 제목(줄바꿈) → 총액(t5 700 · 원까지 · 줄바꿈 없음, 제목 아래) → 메타 Tag Group
 * "{날짜} · {n}명 · 1인당 …"(한 줄 말줄임) → 진행 줄(아바타 스택 24 + 막대 8 + "{낸 수}/{전체}명 냈어요" · 다 냈으면 "모두 냈어요").
 * 낸 수 = 결제자 + 낸 사람. 줄 끝 ⋮ · 밀기 · 줄 사이 선이 없다 — 동작은 상세 안에 있다.
 */
export function DutchSessionRow({
  d,
  onOpen,
}: {
  d: DutchPay;
  onOpen: (d: DutchPay) => void;
}) {
  const { t } = useTranslation("dutchPay");
  const paid = paidCountOf(d);
  const total = d.participants.length;
  const all = d.isSettled || paid >= total;
  return (
    <ListButtonItem
      align="top"
      onClick={() => onOpen(d)}
      title={d.title}
      detail={
        <>
          <span className="mt-[2px] block text-t5 font-bold text-fg-neutral">
            <Won amount={d.totalAmount} />
          </span>
          <TagGroup size="t3" truncate>
            <TagGroupItem>{dutchDate(d.dutchPayDate)}</TagGroupItem>
            <TagGroupItem>{t("memberCount", { count: total })}</TagGroupItem>
            {perPersonOfSession(d).kind !== "none" && (
              <TagGroupItem>
                <PerPersonText info={perPersonOfSession(d)} />
              </TagGroupItem>
            )}
          </TagGroup>
          <span className="mt-[6px] flex items-center gap-x2_5">
            <AvatarStack size={24} aria-hidden>
              {d.participants.map((p) => (
                <Avatar key={p.rowId} name={p.participantName} decorative />
              ))}
            </AvatarStack>
            <ProgressBar
              meaning="goal"
              value={paid}
              max={Math.max(total, 1)}
              aria-label={t("paidProgress", { paid, total })}
              aria-valuetext={t("paidProgress", { paid, total })}
              className="min-w-[24px] flex-1"
            />
            <span className="shrink-0 whitespace-nowrap text-t3 text-fg-neutral-subtle">
              {all ? t("allPaid") : t("paidProgress", { paid, total })}
            </span>
          </span>
        </>
      }
    />
  );
}

/** 첫 진입 — 줄 하나 높이의 자리(제목 · 총액 · 메타 · 진행 줄) */
export function DutchRowSkeleton() {
  return (
    <div className="flex flex-col gap-x1 px-global-gutter py-x3">
      <Skeleton text="t5" className="w-3/5" />
      <Skeleton text="t5" className="w-2/5" />
      <Skeleton text="t3" className="w-4/5" />
      <Skeleton text="t3" className="w-full" />
    </div>
  );
}

/** 친구 줄 — 보기만 하는 ds List 줄: 아바타 36 · 이름(줄바꿈) · "{n}회 함께 정산" · 안 낸 몫이 있으면 오른쪽 "받을 돈" */
function FriendRows({ list }: { list: DutchPay[] }) {
  const { t } = useTranslation("dutchPay");
  const friends = friendsOf(list);
  return (
    <List>
      {friends.map((f) => (
        <ListItem
          key={f.name}
          prefix={<Avatar name={f.name} size={36} />}
          title={f.name}
          detail={t("settledTogether", { count: f.sessions })}
          suffix={
            f.net > 0 ? (
              <span className="text-t4 text-fg-neutral-subtle">
                {t("receivable")} <Won amount={f.net} />
              </span>
            ) : undefined
          }
        />
      ))}
    </List>
  );
}

/**
 * 탭 하나의 내용 — 폰 띠 · 데스크톱 카드가 같이 쓴다. 불러오는 동안 줄 자리 Skeleton, 실패는 Result Section(서버 글 없음) + 다시 시도,
 * 탭마다 빈 화면은 Result Section empty(버튼 없음 — 만들기는 [+] · [정산 만들기] 가 맡는다).
 */
export function DutchTabContent({
  tab,
  active,
  past,
  all,
  loading,
  failed,
  onRetry,
  onOpen,
  size,
}: {
  tab: TabKey;
  active: DutchPay[];
  past: DutchPay[];
  all: DutchPay[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (d: DutchPay) => void;
  size?: "medium";
}) {
  const { t } = useTranslation("dutchPay");
  const { t: tc } = useTranslation("common");
  if (failed)
    return (
      <ResultSection
        kind="failure"
        size={size}
        title={t("loadFailed")}
        description={t("loadFailedDesc")}
        primaryAction={{ label: tc("retry"), onClick: onRetry }}
      />
    );
  if (loading)
    return (
      <div aria-busy="true">
        {[0, 1, 2].map((i) => (
          <DutchRowSkeleton key={i} />
        ))}
      </div>
    );
  if (tab === "friends") {
    return friendsOf(all).length === 0 ? (
      <ResultSection
        size={size}
        icon={<Users />}
        title={t("emptyFriends.title")}
        description={t("emptyFriends.desc")}
      />
    ) : (
      <FriendRows list={all} />
    );
  }
  const rows = tab === "active" ? active : past;
  if (rows.length === 0)
    return (
      <ResultSection
        size={size}
        icon={tab === "active" ? <Users /> : <SearchX />}
        title={t(tab === "active" ? "emptyActive.title" : "emptyPast.title")}
        description={t(
          tab === "active"
            ? size === "medium"
              ? "emptyActive.descWide"
              : "emptyActive.desc"
            : "emptyPast.desc",
        )}
      />
    );
  return (
    <List>
      {rows.map((d) => (
        <DutchSessionRow key={d.rowId} d={d} onOpen={onOpen} />
      ))}
    </List>
  );
}
