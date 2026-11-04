import type { CSSProperties, ReactNode } from "react";
import { ScreenTitle } from "@/shared/ds/top-navigation";
import { cn } from "@/shared/lib/cn";

/**
 * 데스크톱 화면 머리 한 줄(18-2 A) — 제목(h1 · text-screen-title 26/35 · 700 · 한 줄) 아래 설명(16/22 · 400 · muted),
 * 오른쪽에 화면의 주 동작 버튼. h1 은 화면마다 이 부품 하나뿐이고 `data-screen-title` 이라 화면을 옮기면 초점이 온다.
 * 좌우 여백 32 · 머리 아래 20 은 둘러싼 화면 상자(`.page` 등)가 맡는다. 폰은 상단 바의 제목이 화면 제목이라 쓰지 않는다.
 */
export function PageHead({
  leading,
  title,
  description,
  actions,
  className,
  style,
}: {
  /** 제목 앞 붙이개(자산 상세의 Logo Tile 48 — 오른쪽 12). 없으면 지금 모양 그대로 */
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("page__head", className)} style={style}>
      {leading != null ? (
        <div className="flex min-w-0 items-start gap-x3">
          <span className="shrink-0">{leading}</span>
          <div className="min-w-0">
            <ScreenTitle className="mt-0">{title}</ScreenTitle>
            {description != null && <p className="sub">{description}</p>}
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <ScreenTitle className="mt-0">{title}</ScreenTitle>
          {description != null && <p className="sub">{description}</p>}
        </div>
      )}
      {actions != null && <div className="right">{actions}</div>}
    </div>
  );
}
