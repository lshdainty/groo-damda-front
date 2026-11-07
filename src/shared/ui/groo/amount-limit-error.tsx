import { CircleAlert } from "lucide-react";

/**
 * 금액 상한 오류 한 줄 — ds Field 밖의 금액 칸(옛 Field · 행 안의 칸)이 칸 아래에 쓴다. Field 안에서는 Field 의 꼬리가
 * 같은 모양으로 그린다(field.md 오류: 14 `fg-critical` + 아이콘 16, 낱말 단위 줄바꿈). 칸은 `aria-invalid` 와
 * `aria-describedby={id}` 로 잇고, 바뀔 때는 화면 밖 polite 자리가 한 번 읽는다(Field 와 같다 — 보이는 글은 aria-hidden).
 */
export function AmountLimitError({
  id,
  message,
}: {
  id: string;
  message: string | null;
}) {
  return (
    <>
      {message && (
        <p
          id={id}
          aria-hidden
          data-slot="amount-limit-error"
          className="m-0 flex min-w-0 break-keep px-x0_5 text-t4 text-fg-critical"
        >
          <CircleAlert
            aria-hidden
            className="mr-x1_5 mt-[calc((var(--text-t4--line-height)_-_1rem)/2)] size-[16px] shrink-0"
          />
          <span className="min-w-0">{message}</span>
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </>
  );
}
