import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { PageHead } from "@/shared/ui/groo/page-head";
import { useSettingsFrame } from "@/shared/ui/groo/settings-frame-context";

/**
 * ManagerLayout: 설정 화면(카테고리/계좌/예산/알림 등) 상단 영역 공통 spec.
 * 기존 .cat-mgr / __head / __title / __sub / __toolbar / __tabs / __search 의
 * 시각 spec 그대로 보존. 본문은 page 별 children 으로 자유 구성.
 */

const SHELL_CLS = "flex flex-col gap-4";

export function ManagerShell({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${SHELL_CLS} ${className}`}>{children}</div>;
}

/**
 * ManagerHead: 데스크톱에서만 노출되는 화면 제목 줄(제목 + 설명 + 오른쪽 동작) — 받는 값(title · description · actions)은 그대로,
 * 그리는 것은 공용 `PageHead`(h1 26 / 35 · 설명 16 / 22 · 동작은 h1 줄 가운데)다(I-16 27).
 * 설정 틀 안이면 틀이 둔 제목 줄 자리로 그린다(위젯마다 달랐던 제목 줄 ↔ 첫 내용 간격을 틀 한 곳이 정한다) —
 * 틀 밖(단독 렌더)이면 제자리에 그린다. 모바일에서는 페이지가 알아서 분기하므로 그대로 안 쓰면 됨.
 */
export function ManagerHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const frame = useSettingsFrame();
  const head = (
    <PageHead title={title} description={description} actions={actions} />
  );
  if (!frame) return head;
  return frame.headSlot ? createPortal(head, frame.headSlot) : null;
}

/**
 * ManagerTabs (cat-mgr__tabs): segmented toggle — tabs.md Container 룩.
 * active = surface-default pill + shadow-sm + text-primary (brand 채움 아님). count 배지 유지.
 */
/**
 * ManagerTabs — 관리 화면 탭. shared `Tabs`(tabs.md pills variant) 그대로 사용한다.
 * 자체 button/inline-style 로 pills 를 모방하면 spec 변경 시 어긋나므로 금지(CLAUDE.md).
 * count 는 라벨에 인라인으로 붙인다 — active(brand 채움) 위에서도 읽히도록 색 분리.
 */
export function ManagerTabs<T extends string>({
  value,
  options,
  onChange,
  fill = false,
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  /** true 면 가로 전체를 균등 분할 (앱 PToggleGroup expanded 톤). 모바일에서 사용. */
  fill?: boolean;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={fill ? "w-full" : "w-fit self-start"}
    >
      <TabsList
        variant="pills"
        size="sm"
        className={fill ? "flex w-full" : undefined}
      >
        {options.map((o) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            className={fill ? "flex-1" : undefined}
          >
            {o.label}
            {o.count != null && (
              <span className="ml-1.5 opacity-70">{o.count}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
