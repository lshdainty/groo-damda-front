import * as React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/index";
import { Input } from "@/shared/ui/input";

/*
 * SearchableList — groo-design spec searchable-list.md SoT 정합.
 * header (label + 총 개수) + search input + scrollable result list (single-select pattern).
 * 사용처: 카드 카탈로그·은행·증권사·종목 등 대량 옵션 + 검색.
 */

type SearchableListProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  totalCount?: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  loadingSkeleton?: React.ReactNode;
  maxHeight?: number | string;
  headerExtras?: React.ReactNode;
};

const SearchableList = React.forwardRef<HTMLDivElement, SearchableListProps>(
  (
    {
      label,
      totalCount,
      searchValue,
      onSearchChange,
      placeholder,
      emptyText,
      isLoading,
      loadingSkeleton,
      maxHeight = 260,
      headerExtras,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const hasChildren = React.Children.count(children) > 0;
    const showHeader =
      label != null || typeof totalCount === "number" || headerExtras != null;
    return (
      <div ref={ref} className={className} {...props}>
        {showHeader && (
          <div className="flex items-center justify-between mb-2">
            {label != null ? (
              <span className="text-[13px] font-medium text-fg-neutral">
                {label}
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {headerExtras}
              {typeof totalCount === "number" && (
                <span className="text-[11px] text-fg-neutral-subtle">
                  {t("totalCount", { count: totalCount })}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-neutral-subtle"
          />
          <Input
            search
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder ?? t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div
          className={cn(
            "rounded-[var(--radius-r2)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]",
            "divide-y divide-[var(--border-subtle)] overflow-y-auto",
          )}
          style={{ maxHeight }}
        >
          {isLoading ? (
            loadingSkeleton
          ) : hasChildren ? (
            children
          ) : (
            <div className="py-6 text-center text-[12px] text-fg-neutral-subtle">
              {emptyText ?? t("searchEmpty")}
            </div>
          )}
        </div>
      </div>
    );
  },
);
SearchableList.displayName = "SearchableList";

type SearchableListItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "title"
> & {
  active?: boolean;
  thumbnail?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  dim?: boolean;
};

const SearchableListItem = React.forwardRef<
  HTMLButtonElement,
  SearchableListItemProps
>(
  (
    {
      active,
      thumbnail,
      title,
      subtitle,
      trailing,
      dim,
      className,
      style,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
        !active && "hover:bg-bg-neutral-weak",
        className,
      )}
      style={{
        background: active ? "var(--bg-brand-subtle)" : undefined,
        opacity: dim && !active ? 0.7 : 1,
        ...style,
      }}
      {...props}
    >
      {thumbnail != null && <span className="flex-shrink-0">{thumbnail}</span>}
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block truncate text-[13px] flex items-center gap-1.5",
            active ? "font-semibold" : "font-medium",
          )}
          style={{
            color: active ? "var(--fg-brand-strong)" : "var(--fg-primary)",
          }}
        >
          {title}
        </span>
        {subtitle != null && (
          <span className="block truncate mt-0.5 text-[11.5px] text-fg-neutral-subtle">
            {subtitle}
          </span>
        )}
      </span>
      {trailing != null && <span className="flex-shrink-0">{trailing}</span>}
    </button>
  ),
);
SearchableListItem.displayName = "SearchableListItem";

export { SearchableList, SearchableListItem };
export type { SearchableListProps, SearchableListItemProps };
