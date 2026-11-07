import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";

/**
 * 줄 제목 — 증권사 이름 + (기본이면) 이름 옆 배지.
 *
 * 틈은 배지의 왼쪽 여백이 아니라 묶음의 사이 간격(gap)이다 — 이름이 길어 배지가 다음 줄 맨 앞에 서면 앞 틈 없이 글의 왼쪽 선에
 * 맞는다(list.md "제목 뒤 배지는 줄이 바뀌면 앞 틈 없이"). "기본" 은 neutral 이다(badge.md — 같은 뜻은 어느 화면에서나 같은 톤).
 */
export function BrokerTitle({
  name,
  primary,
}: {
  name: string;
  primary: boolean;
}) {
  const { t } = useTranslation("subscription");
  return (
    <span className="flex flex-wrap items-center gap-x-x1_5">
      <span>{name}</span>
      {primary && (
        <Badge variant="weak" tone="neutral">
          {t("broker.primary")}
        </Badge>
      )}
    </span>
  );
}
