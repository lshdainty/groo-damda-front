import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Callout } from "@/shared/ds/callout";
import { ListHeader } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";

/*
 * 캘린더 관리 · 공유 / 라벨 화면이 함께 쓰는 조각 (I-09 09-3 · 37 ~ 49).
 * 흰 면 하나 — 폰은 카드 · 선 · 틈 없이 줄 · 목록 제목이 제 좌우 24 를 갖고, 데스크톱은 목록마다 Card body="list" 에 담는다.
 */

/**
 * 안내 = Callout informative (38 · 45) — 흰 면 위 예외. 제목 없이 본문 한 문단.
 * 폰은 좌우 24 · 위 16 · 아래 8(그림 .cpad), 데스크톱은 카드 밖에 그대로(아래 8 만 — 카드와 사이 16).
 */
export function ManageIntro({
  children,
  mobile,
}: {
  children: ReactNode;
  mobile: boolean;
}) {
  return (
    <div className={mobile ? "px-x6 pb-x2 pt-x4" : "pb-x2"}>
      <Callout tone="informative" icon={<Info aria-hidden />}>
        {children}
      </Callout>
    </div>
  );
}

/**
 * 목록 한 묶음 — 목록 제목(boldSolid) + 오른쪽 글 버튼(있으면) + 줄들.
 * 폰은 첫 묶음 아래에서 위로 16 띄운다(Callout 아래 8 + 제목 위 8 은 첫 묶음, 그다음 묶음은 위 16 + 제목 위 8).
 * 데스크톱은 묶음마다 Card body="list" 안이라 위 여백이 카드 몫이다.
 */
export function ManageSection({
  id,
  title,
  action,
  first,
  mobile,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  first: boolean;
  mobile: boolean;
  children: ReactNode;
}) {
  const head = (
    <ListHeader
      as="div"
      variant="boldSolid"
      className={cn(mobile && !first && "mt-x4")}
    >
      <h2 id={id} className="m-0 font-[inherit] text-[length:inherit]">
        {title}
      </h2>
      {action}
    </ListHeader>
  );
  return (
    <section>
      {head}
      {children}
    </section>
  );
}

/** 빈 글 — R9(t4 · fg-neutral-subtle) 가운데, 아래에 한 줄 더(hint)가 있으면 t3 */
export function ManageEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-x6 py-x3 text-center">
      <p className="m-0 text-t4 text-fg-neutral-subtle">{title}</p>
      {hint && (
        <p className="m-0 mt-x1 text-t3 text-fg-neutral-subtle">{hint}</p>
      )}
    </div>
  );
}

/** 불러오는 중 — 줄 모양 그대로(앞 타일 40 · 제목 t5 · 설명 t3), 카드 · 선 없이. 실제 줄은 위아래 12 · 높이 64 */
export function ManageRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
          <Skeleton radius="12" className="size-x10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton text="t5" className="w-1/2" />
            <Skeleton text="t3" className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
