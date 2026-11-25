import { useRef, useState, type FocusEvent, type ReactNode } from "react";

import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/shared/ds/table";
import { Card } from "@/shared/ds/card";

import { TablePagination, type TablePaginationValue } from "./table-pagination";

const noop = () => {};

// 줄은 늘 한 줄이라 내용 폭(약 560) 아래로 줄지 않는다 — 폭을 정해 둔 칸
const Strip = ({
  children,
  width = 640,
}: {
  children: ReactNode;
  width?: number;
}) => (
  <div
    className="shrink-0 rounded-r3 bg-bg-layer-default p-x4"
    style={{ width }}
  >
    <div className="overflow-x-auto">{children}</div>
  </div>
);

// 호버 · 누름 · 포커스 견본 — 검사기가 틀 가운데를 올리고 누른다. 40 × 40 틀의 오른쪽 끝에 줄의 오른쪽 끝(= "다음" 칸)을 맞춰
// 틀 가운데가 "다음" 칸이 되게 한다. 줄의 위 12(표 아래 간격)는 위로 당겨 줄 높이 40 이 틀 높이 40 과 같게 한다
const OnNext = ({
  children,
  focus,
}: {
  children: ReactNode;
  focus?: boolean;
}) => (
  <div
    className="relative ml-auto size-10"
    {...(focus
      ? {
          tabIndex: -1,
          onFocus: (e: FocusEvent<HTMLElement>) => {
            if (e.target !== e.currentTarget) return;
            e.currentTarget
              .querySelector<HTMLElement>("[data-slot=table-pagination-next]")
              ?.focus({ preventScroll: true });
          },
        }
      : {})}
  >
    <div className="absolute -top-x3 right-0">{children}</div>
  </div>
);

const USERS = Array.from({ length: 237 }, (_, i) => `사용자 ${i + 1}`);

// 표와 같이 움직이는 줄 — 넘기면 표 맨 위로 스크롤 · 줄 수를 바꾸면 첫 범위로
// 열이 넘치는 표(wide) — 표만 가로로 밀리고 넘김 줄은 표 상자의 보이는 폭에 붙어 그대로다(groo-design #272)
const WIDE_COLUMNS = ["직위", "입사일", "이메일", "전화", "근무지"] as const;

const WithTable = ({ wide = false }: { wide?: boolean }) => {
  const [value, setValue] = useState<TablePaginationValue>({
    page: 1,
    pageSize: 10,
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const start = (value.page - 1) * value.pageSize;
  const rows = USERS.slice(start, start + value.pageSize);
  return (
    <Card body="list">
      <Table
        ref={boxRef}
        caption="사용자"
        className="max-h-72"
        tableClassName={wide ? "min-w-[960px]" : undefined}
        stickyHeader
        pagination={
          <TablePagination
            totalItems={USERS.length}
            value={value}
            onValueChange={setValue}
            scrollTarget={boxRef}
          />
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>부서</TableHead>
            {wide &&
              WIDE_COLUMNS.map((c) => <TableHead key={c}>{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u} onClick={noop}>
              <TableRowHeader>{u}</TableRowHeader>
              <TableCell>개발팀</TableCell>
              {wide &&
                WIDE_COLUMNS.map((c) => <TableCell key={c}>{c}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

/** 카탈로그(/dev/ds) — 전체 수를 앎 · 모름 · 0개, 호버 · 누름 · 포커스, 끝에서 막힘, 표 아래 보이는 폭에 붙는 줄 */
export const TablePaginationDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="전체 수를 앎 — 줄 수 고르기 + 씩 보기 · 범위 고르기 + / 총 N개 · 이전 · 다음(40)">
      <DemoRow label="known">
        <Strip>
          <Specimen spec="table-pagination" combo={{}}>
            <div>
              <TablePagination
                totalItems={1240}
                defaultValue={{ page: 5, pageSize: 25 }}
              />
            </div>
          </Specimen>
        </Strip>
      </DemoRow>
      <DemoRow label="hovered">
        <Strip>
          <Specimen spec="table-pagination" combo={{}} state="hovered">
            <OnNext>
              <TablePagination
                totalItems={237}
                defaultValue={{ page: 5, pageSize: 10 }}
              />
            </OnNext>
          </Specimen>
        </Strip>
      </DemoRow>
      <DemoRow label="pressed">
        <Strip>
          <Specimen spec="table-pagination" combo={{}} state="pressed">
            <OnNext>
              <TablePagination
                totalItems={237}
                defaultValue={{ page: 5, pageSize: 10 }}
              />
            </OnNext>
          </Specimen>
        </Strip>
      </DemoRow>
      <DemoRow label="focused">
        <Strip>
          <Specimen spec="table-pagination" combo={{}} state="focused">
            <OnNext focus>
              <TablePagination
                totalItems={237}
                defaultValue={{ page: 5, pageSize: 10 }}
              />
            </OnNext>
          </Specimen>
        </Strip>
      </DemoRow>
      <DemoRow label="끝 쪽 — 다음 막힘">
        <Strip>
          <TablePagination
            totalItems={237}
            defaultValue={{ page: 24, pageSize: 10 }}
          />
        </Strip>
        <Strip>
          <TablePagination
            totalItems={237}
            defaultValue={{ page: 1, pageSize: 10 }}
          />
        </Strip>
      </DemoRow>
      <DemoRow label="빈 표 0-0">
        <Strip>
          <Specimen
            spec="table-pagination"
            combo={{ total: "empty" }}
            state="disabled"
          >
            <div>
              <TablePagination totalItems={0} />
            </div>
          </Specimen>
        </Strip>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="전체 수를 모름 — 범위는 글로만(다음이 있는지만 안다)">
      <DemoRow label="unknown">
        <Strip>
          <Specimen spec="table-pagination" combo={{ total: "unknown" }}>
            <div>
              <TablePagination
                hasPreviousPage
                hasNextPage
                currentPageItemCount={10}
                defaultValue={{ page: 2, pageSize: 10 }}
              />
            </div>
          </Specimen>
        </Strip>
        <Strip>
          <TablePagination
            hasPreviousPage
            hasNextPage={false}
            currentPageItemCount={4}
            defaultValue={{ page: 3, pageSize: 10 }}
          />
        </Strip>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="가장 나쁜 값 — 1억 건(쉼표 · 범위 목록 200개 넘으면 둘레만) · 막힌 줄 · 줄 수 100">
      <DemoRow label="worst">
        <Strip>
          <TablePagination
            totalItems={123_456_789}
            defaultValue={{ page: 61_728, pageSize: 100 }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </Strip>
        <Strip>
          <TablePagination
            totalItems={237}
            defaultValue={{ page: 3, pageSize: 10 }}
            disabled
          />
        </Strip>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="표와 함께 — 넘김 줄은 표 상자의 보이는 폭에 붙어 열이 넘쳐 표를 가로로 밀어도 그대로 있고, 넘기면 표 맨 위로 스크롤한다">
      <DemoRow label="with Table">
        <div
          style={{ width: 640 }}
          className="rounded-r3 bg-bg-layer-basement p-x4"
        >
          <WithTable />
        </div>
      </DemoRow>
      <DemoRow label="wide Table">
        <div
          style={{ width: 640 }}
          className="rounded-r3 bg-bg-layer-basement p-x4"
          data-demo="table-pagination-wide"
        >
          <WithTable wide />
        </div>
      </DemoRow>
    </DemoBlock>
  </div>
);
