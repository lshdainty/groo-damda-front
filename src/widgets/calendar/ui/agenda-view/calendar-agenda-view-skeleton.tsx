import { List, ListHeader, ListItem } from "@/shared/ds/list";
import { Skeleton, SkeletonGroup } from "@/shared/ds/skeleton";

/**
 * 목록 보기의 첫 불러오기 자리 — 날 머리 한 줄 + 그날 패널 줄(앞 타일 · 제목 · 설명) 자리, 다섯 날.
 * 실제 목록과 같은 부품(List)이라 데이터로 바뀔 때 줄이 움직이지 않는다.
 */
const CalendarAgendaViewSkeleton = () => (
  <SkeletonGroup className="h-full w-full overflow-hidden">
    <div className="flex flex-col gap-x3 pb-x4 pt-x2">
      {[2, 1, 2, 1, 1].map((rows, day) => (
        <div key={day} aria-hidden>
          <ListHeader as="div">
            <Skeleton text="t4" className="w-[96px]" />
          </ListHeader>
          <List>
            {Array.from({ length: rows }, (_, i) => (
              <ListItem
                key={i}
                prefix={<Skeleton radius="12" className="size-[40px]" />}
                title={<Skeleton text="t5" className="w-[128px] max-w-full" />}
                detail={<Skeleton text="t3" className="w-[96px] max-w-full" />}
              />
            ))}
          </List>
        </div>
      ))}
    </div>
  </SkeletonGroup>
);

export { CalendarAgendaViewSkeleton };
