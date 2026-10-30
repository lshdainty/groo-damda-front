import type { ReactNode } from "react";
import { ListItem } from "@/shared/ds/list";

/**
 * 키-값 줄(I-17 45) — 열쇠 t5 `fg-neutral`, 값은 줄 끝 오른쪽 맞춤(`fg-neutral-muted`, 몇 줄이든 text-end — 값 맞춤 규칙).
 * 값이 없으면 그리지 않는다. 21-1 웹의 `KvRow`(widgets/expense-detail tx-detail-parts)와 이름 · props 가 같다 —
 * 둘 중 먼저 머지되는 쪽이 남고 뒤쪽이 rebase 때 자기 것을 지우고 이것을 쓴다(21-1 KvRow 와 같은 부품으로 합칠 예정).
 */
export function KvRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <ListItem
      title={label}
      suffixText
      suffix={
        <span className="block text-end text-fg-neutral-muted [overflow-wrap:anywhere]">
          {value}
        </span>
      }
    />
  );
}
