import { useState } from "react";
import { PageHead } from "@/shared/ui/groo/page-head";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/ui/input";
import { Search, SearchX } from "lucide-react";
import { useMoreGroups } from "../model/use-more-groups";
import { MoreMobile } from "./MoreMobile";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/** 폰은 MoreMobile, 데스크톱은 여기(들어오는 길이 없어 그대로 둔다) */
export const MorePage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  return mobile ? <MoreMobile /> : <MoreDesktop />;
};

const MoreDesktop = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("more");
  const { t: tLayout } = useTranslation("layout");
  const [query, setQuery] = useState("");
  const filtered = useMoreGroups(query);

  return (
    <div
      style={{
        padding: "var(--spacing-xs) var(--spacing-xl) var(--spacing-xl)",
      }}
    >
      {/* 폰은 상단 바의 제목이 화면 제목이다 — 데스크톱만 본문 맨 위 h1 */}
      <PageHead title={tLayout("all")} />
      {/* 검색바 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "var(--bg-surface)",
          paddingBottom: "var(--spacing-sm)",
        }}
      >
        {/* 아이콘 세로 중앙 기준은 input 높이 — sticky wrapper의 paddingBottom에 안 끌리도록 분리 */}
        <div className="relative">
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-tertiary)",
              pointerEvents: "none",
            }}
          />
          <Input
            search
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="w-full pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: "var(--fg-tertiary)",
          }}
        >
          <SearchX size={28} style={{ display: "inline-block" }} />
          <div
            style={{
              fontSize: "var(--text-label-sm)",
              fontWeight: 600,
              marginTop: 8,
            }}
          >
            {t("noResults")}
          </div>
        </div>
      ) : (
        filtered.map((group, gi) => (
          <div key={group.labelKey}>
            {/* 그룹 사이 헤어라인 */}
            {gi > 0 && (
              <div
                style={{
                  height: 1,
                  background: "var(--border-subtle)",
                  margin: "14px 0",
                }}
              />
            )}
            <div
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: 700,
                color: "var(--fg-primary)",
                letterSpacing: "-0.01em",
                padding: "14px 0 2px",
              }}
            >
              {t(group.labelKey)}
            </div>
            {/* K뱅크 스타일 — 카드 없이 2열 텍스트 링크 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                padding: "6px 0 4px",
                columnGap: 16,
              }}
            >
              {group.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "13px 0",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "var(--text-body-md)",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: "var(--fg-primary)",
                    fontFamily: "inherit",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.opacity = "0.55";
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.7";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
