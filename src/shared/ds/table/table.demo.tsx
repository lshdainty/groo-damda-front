import { useState, type FocusEvent, type ReactNode } from "react";
import { ReceiptText, SearchX, Trash2 } from "lucide-react";

import { Avatar } from "@/shared/ds/avatar";
import { ImageFrame } from "@/shared/ds/image-frame";
import { PHOTO } from "@/shared/ds/image-frame/image-frame-samples";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/shared/ds/card";
import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";
import { List, ListButtonItem } from "@/shared/ds/list";
import { ResponsiveMenuContent, ResponsiveMenuItem } from "@/shared/ds/menu";
import { ResultSection } from "@/shared/ds/result-section";

import {
  Table,
  TableBody,
  TableBulkBar,
  TableCell,
  TableCellContent,
  TableHead,
  TableHeader,
  TableMoreCell,
  TableMoreHead,
  TableRow,
  TableRowHeader,
  TableSelectCell,
  TableSelectHead,
  TableSkeletonRows,
  TableStatusRow,
  type TableSort,
  type TableSortDirection,
} from "./table";

const noop = () => {};

type User = {
  id: number;
  name: string;
  dept: string;
  days: string;
  status: string;
  tone: "positive" | "warning" | "neutral";
};
const USERS: User[] = [
  {
    id: 1,
    name: "김하늘",
    dept: "개발팀",
    days: "12.5일",
    status: "재직",
    tone: "positive",
  },
  {
    id: 2,
    name: "박서준",
    dept: "디자인팀",
    days: "3일",
    status: "휴직",
    tone: "warning",
  },
  {
    id: 3,
    name: "이도윤",
    dept: "경영지원팀",
    days: "0일",
    status: "초대 대기",
    tone: "neutral",
  },
];

// 카드 안에 가장자리까지 — 표는 카드(바닥 위 흰 면)에 담는다. 폭은 데스크톱 칸
const Floor = ({
  children,
  width = 760,
}: {
  children: ReactNode;
  width?: number;
}) => (
  <div
    className="flex shrink-0 flex-col gap-x2 rounded-r3 bg-bg-layer-basement p-x4"
    style={{ width }}
  >
    {children}
  </div>
);

const TableCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Card body="list">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardAction onClick={noop}>관리</CardAction>
    </CardHeader>
    {children}
  </Card>
);

// 줄 끝 ⋮ — 1280 이상 Menu · 미만 Menu Sheet
const RowMenu = ({ name }: { name: string }) => (
  <TableMoreCell label={name}>
    <ResponsiveMenuContent title={name}>
      <ResponsiveMenuItem label="수정" onSelect={noop} />
      <ResponsiveMenuItem label="삭제" tone="critical" onSelect={noop} />
    </ResponsiveMenuContent>
  </TableMoreCell>
);

type UsersProps = {
  sort?: TableSort;
  onSort?: (next: TableSortDirection) => void;
  rows?: User[];
  align?: "start" | "end";
};

// 사용자 표 — 이름 · 부서 · 남은 휴가 · 상태 · ⋮. 가운데 칸(부서)은 정렬 버튼이 없다(검사기가 칸 여백을 잰다)
const UsersTable = ({
  sort,
  onSort,
  rows = USERS,
  align = "start",
}: UsersProps) => (
  <Table caption="사용자">
    <TableHeader>
      <TableRow>
        <TableHead align={align}>이름</TableHead>
        <TableHead align={align}>부서</TableHead>
        <TableHead align={align} sort={sort} onSortChange={onSort}>
          남은 휴가
        </TableHead>
        <TableHead>상태</TableHead>
        <TableMoreHead />
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((u) => (
        <TableRow key={u.id} onClick={noop}>
          <TableRowHeader align={align} href="#table">
            {u.name}
          </TableRowHeader>
          <TableCell align={align}>{u.dept}</TableCell>
          <TableCell align={align}>{u.days}</TableCell>
          <TableCell>
            <Badge tone={u.tone}>{u.status}</Badge>
          </TableCell>
          <RowMenu name={u.name} />
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

// 검사기가 견본 틀에 준 키보드 포커스를 안의 정렬 버튼 · 이름 링크로 넘긴다 — 틀은 초점을 받지 않는다
const passFocus = (selector: string) => ({
  tabIndex: -1,
  onFocus: (e: FocusEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    e.currentTarget
      .querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: true });
  },
});

// 줄 하나 표 — 틀 가운데가 줄에 오게(머리 줄 41 + 줄 45 = 86, 가운데 43)
const OneRow = ({ href }: { href?: boolean }) => (
  <Table caption="한 줄">
    <TableHeader>
      <TableRow>
        <TableHead>이름</TableHead>
        <TableHead>부서</TableHead>
        <TableHead>상태</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow onClick={noop}>
        <TableRowHeader href={href ? "#table" : undefined}>
          김하늘
        </TableRowHeader>
        <TableCell>개발팀</TableCell>
        <TableCell>재직</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

// 정렬 버튼만 — 머리 줄 하나라 틀 가운데가 정렬 버튼이다
const HeadOnly = ({ sort }: { sort: TableSort }) => (
  <Table caption="머리만">
    <TableHeader>
      <TableRow>
        <TableHead sort={sort} onSortChange={noop}>
          남은 휴가
        </TableHead>
      </TableRow>
    </TableHeader>
  </Table>
);

const RICH_ROWS = [
  { name: "김하늘", id: "HR-0012", dept: "개발팀", mail: "haneul@groo.kr" },
  { name: "박서준", id: "HR-0031", dept: "디자인팀", mail: "seojun@groo.kr" },
];

// 썸네일 자리 — 사람은 Avatar 42(table.md). Image Frame 48 은 위아래 12 + 선 1 로 73 이라 72 를 넘어 새로 두지 않는다
const Thumb = ({ name }: { name: string }) => <Avatar name={name} size={42} />;

// 고르는 표 — 머리 체크(전체 · 일부) · 줄 체크 · 표 위 일괄 작업 바. 고른 줄에는 바탕이 없다
const SelectTable = ({ picked }: { picked: Set<number> }) => (
  <Table caption="업무 보고">
    <TableHeader>
      <TableRow>
        <TableSelectHead
          checked={
            picked.size === USERS.length
              ? true
              : picked.size > 0
                ? "indeterminate"
                : false
          }
          onCheckedChange={noop}
        />
        <TableHead>제목</TableHead>
        <TableHead>부서</TableHead>
        <TableHead>상태</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {USERS.map((u) => (
        <TableRow key={u.id} onClick={noop}>
          <TableSelectCell
            label={u.name}
            checked={picked.has(u.id)}
            onCheckedChange={noop}
          />
          <TableCell>{u.name} 주간 보고</TableCell>
          <TableCell>{u.dept}</TableCell>
          <TableCell>{u.status}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const Bar = ({ count }: { count: number }) => (
  <TableBulkBar count={count} onClear={noop}>
    <Button variant="ghost" size="small" onClick={noop}>
      내보내기
    </Button>
    <Button variant="ghost" size="small" onClick={noop}>
      <Trash2 />
      삭제
    </Button>
  </TableBulkBar>
);

// 값이 직접 움직이는 표 — 정렬(두 단계) · 고르기
const InteractiveDemo = () => {
  const [sortBy, setSortBy] = useState<"name" | "days" | null>("days");
  const [dir, setDir] = useState<TableSortDirection>("descending");
  const [picked, setPicked] = useState<Set<number>>(new Set([1]));
  const rows = [...USERS].sort((a, b) => {
    if (sortBy === "name") {
      const r = a.name.localeCompare(b.name, "ko");
      return dir === "ascending" ? r : -r;
    }
    const r = parseFloat(a.days) - parseFloat(b.days);
    return dir === "ascending" ? r : -r;
  });
  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <TableCard title="사용자 (직접 눌러 보기)">
      <Bar count={picked.size} />
      <Table caption="사용자">
        <TableHeader>
          <TableRow>
            <TableSelectHead
              checked={
                picked.size === USERS.length
                  ? true
                  : picked.size > 0
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(on) =>
                setPicked(on ? new Set(USERS.map((u) => u.id)) : new Set())
              }
            />
            <TableHead
              sort={sortBy === "name" ? dir : "none"}
              onSortChange={(d) => {
                setSortBy("name");
                setDir(d);
              }}
            >
              이름
            </TableHead>
            <TableHead
              align="end"
              sort={sortBy === "days" ? dir : "none"}
              onSortChange={(d) => {
                setSortBy("days");
                setDir(d);
              }}
            >
              남은 휴가
            </TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableSelectCell
                label={u.name}
                checked={picked.has(u.id)}
                onCheckedChange={() => toggle(u.id)}
              />
              <TableRowHeader>{u.name}</TableRowHeader>
              <TableCell align="end">{u.days}</TableCell>
              <TableCell>
                <Badge tone={u.tone}>{u.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
};

// 가장 나쁜 값 — 열 여덟 · 긴 셀 · 1억 넘는 금액 · 줄 200 · 머리 고정
const WIDE_COLS = [
  "이름",
  "부서",
  "직급",
  "입사일",
  "남은 휴가",
  "이번 달 지출",
  "상태",
  "메모",
];
const WorstDemo = () => (
  <TableCard title="열 여덟 · 긴 셀 · 줄 200 (상자 안에서 스크롤 — 머리 고정)">
    <Table
      caption="가장 나쁜 값"
      stickyHeader
      className="max-h-80"
      tableClassName="min-w-[1100px]"
    >
      <TableHeader>
        <TableRow>
          {WIDE_COLS.map((c, i) => (
            <TableHead key={c} align={i === 4 || i === 5 ? "end" : "start"}>
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 200 }, (_, i) => (
          <TableRow key={i} onClick={noop}>
            <TableRowHeader>김하늘 {i + 1}</TableRowHeader>
            <TableCell>개발팀</TableCell>
            <TableCell>선임</TableCell>
            <TableCell>2021-03-02</TableCell>
            <TableCell align="end">12.5일</TableCell>
            <TableCell align="end">−123,456,789,012원</TableCell>
            <TableCell>재직</TableCell>
            <TableCell className="max-w-64 truncate">
              아주 긴 메모가 칸 안에서 한 줄로 이어질 때 잘리는 모습을 본다
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableCard>
);

/** 카탈로그(/dev/ds) — 줄 종류 · 숫자 열 · 정렬 · 고르기와 일괄 작업 바 · 줄 끝 ⋮ · 비었음 · 실패 · 기다림 · 머리 고정 · 폰 판 */
export const TableDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="한 줄 표(머리 41 · 줄 45) — 이름 링크 · 숫자 오른쪽 · 상태 Badge · 줄 끝 ⋮">
      <DemoRow label="text">
        <Floor>
          <TableCard title="사용자">
            <Specimen spec="table" combo={{}}>
              <div>
                <UsersTable />
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="hovered · pressed">
        {(["hovered", "pressed"] as const).map((state) => (
          <Floor key={state} width={360}>
            <Card body="list">
              <Specimen spec="table" combo={{}} state={state}>
                <div>
                  <OneRow />
                </div>
              </Specimen>
            </Card>
          </Floor>
        ))}
      </DemoRow>
      <DemoRow label="focused">
        <Floor width={360}>
          <Card body="list">
            <Specimen spec="table" combo={{}} state="focused">
              <div {...passFocus("[data-slot=table-row-link]")}>
                <OneRow href />
              </div>
            </Specimen>
          </Card>
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="줄 종류 rich(72) — 썸네일 · 두 줄 칸이 하나라도 있으면 모든 줄">
      <DemoRow label="rich">
        <Floor>
          <TableCard title="사용자">
            <Specimen spec="table" combo={{ row: "rich" }}>
              <div>
                <Table caption="사용자" rowHeight="rich">
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>부서</TableHead>
                      <TableHead>메일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RICH_ROWS.map((u) => (
                      <TableRow key={u.id} onClick={noop}>
                        <TableRowHeader>
                          <TableCellContent
                            media={<Thumb name={u.name} />}
                            title={u.name}
                            detail={u.id}
                          />
                        </TableRowHeader>
                        <TableCell>{u.dept}</TableCell>
                        <TableCell>{u.mail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="rich 의 가장 나쁜 값 — 긴 글이 두 · 세 줄이어도 위아래 12 를 지킨다(72 는 최소 높이)">
      <DemoRow label="rich · 긴 글">
        <Floor>
          <TableCard title="결재함">
            <div className="w-[520px] max-w-full">
              <Table caption="결재함" rowHeight="rich">
                <TableHeader>
                  <TableRow>
                    <TableHead>정책</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow onClick={noop}>
                    <TableRowHeader>
                      <TableCellContent title="연차" detail="2026-11-10" />
                    </TableRowHeader>
                    <TableCell>승인</TableCell>
                  </TableRow>
                  <TableRow onClick={noop}>
                    <TableRowHeader>
                      <TableCellContent
                        title="경조사 휴가 — 본인 결혼 · 배우자 출산 · 직계 가족 사망 시 신청하는 특별 휴가 정책"
                        detail="2026-11-10 · 두 번째 줄 설명이 길어서 줄이 바뀌는 경우의 글"
                      />
                    </TableRowHeader>
                    <TableCell>대기</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="rich · Image Frame 48 (칸만 위아래 0)">
        <Floor>
          <TableCard title="상품">
            <div className="w-[520px] max-w-full">
              <Table caption="상품" rowHeight="rich">
                <TableHeader>
                  <TableRow>
                    <TableHead>상품</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow onClick={noop}>
                    <TableRowHeader thumbnail>
                      <TableCellContent
                        media={
                          <ImageFrame
                            ratio="1:1"
                            width={48}
                            src={PHOTO}
                            alt=""
                          />
                        }
                        title="나무 책상"
                        detail="SKU-0042"
                      />
                    </TableRowHeader>
                    <TableCell>판매 중</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TableCard>
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="숫자 열 — 머리까지 오른쪽 · 고정폭 숫자 · 돈은 원까지, 빼기는 U+2212">
      <DemoRow label="end">
        <Floor>
          <TableCard title="이번 달 지출">
            <Specimen spec="table" combo={{ align: "end" }}>
              <div>
                <Table caption="이번 달 지출">
                  <TableHeader>
                    <TableRow>
                      <TableHead align="end">구분</TableHead>
                      <TableHead align="end">금액</TableHead>
                      <TableHead align="end">비율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow onClick={noop}>
                      <TableRowHeader align="end">식비</TableRowHeader>
                      <TableCell align="end">1,240,000원</TableCell>
                      <TableCell align="end">41.3%</TableCell>
                    </TableRow>
                    <TableRow onClick={noop}>
                      <TableRowHeader align="end">환급</TableRowHeader>
                      <TableCell align="end">−123,456,789,012원</TableCell>
                      <TableCell align="end">▲ 12.5%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="정렬 — 정렬할 수 있는 열에 ↑↓ 를 늘, 지금 방향만 짙게 · 누를 때마다 내림 ↔ 오름">
      <DemoRow label="sortable">
        <Floor>
          <TableCard title="사용자">
            <Specimen spec="table" combo={{ sort: "sortable" }}>
              <div>
                <UsersTable sort="none" onSort={noop} />
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="ascending">
        <Floor>
          <TableCard title="사용자">
            <Specimen spec="table" combo={{ sort: "ascending" }}>
              <div>
                <UsersTable sort="ascending" onSort={noop} />
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="descending">
        <Floor>
          <TableCard title="사용자">
            <Specimen spec="table" combo={{ sort: "descending" }}>
              <div>
                <UsersTable sort="descending" onSort={noop} />
              </div>
            </Specimen>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="hovered · pressed · focused">
        {(["hovered", "pressed", "focused"] as const).map((state) => (
          <Floor key={state} width={220}>
            <Card body="list">
              <Specimen spec="table" combo={{ sort: "sortable" }} state={state}>
                <div
                  {...(state === "focused"
                    ? passFocus("[data-slot=table-sort-button]")
                    : {})}
                >
                  <HeadOnly sort="none" />
                </div>
              </Specimen>
            </Card>
          </Floor>
        ))}
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="고르기 — 머리 체크(전체 · 일부) · 고른 줄은 바탕 없이 체크로만 · 고르면 표 위에 일괄 작업 바(bg-brand-weak 48)">
      {(["empty", "some", "all"] as const).map((selection) => (
        <DemoRow key={selection} label={selection}>
          <Floor>
            <TableCard title="업무 보고">
              <Specimen spec="table" combo={{ selection }}>
                <div>
                  <Bar
                    count={
                      selection === "empty" ? 0 : selection === "some" ? 2 : 3
                    }
                  />
                  <SelectTable
                    picked={
                      selection === "empty"
                        ? new Set()
                        : selection === "some"
                          ? new Set([1, 2])
                          : new Set([1, 2, 3])
                    }
                  />
                </div>
              </Specimen>
            </TableCard>
          </Floor>
        </DemoRow>
      ))}
      <DemoRow label="직접">
        <Floor>
          <InteractiveDemo />
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="불러오는 동안 · 비었음 · 실패 — 머리 줄은 처음부터, 줄 자리만 Skeleton · 비었음과 실패는 본문 자리 한 칸의 Result Section">
      <DemoRow label="기다림">
        <Floor>
          <TableCard title="사용자">
            <Table caption="사용자">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead align="end">남은 휴가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeletonRows
                  rows={4}
                  columns={[
                    { width: "40%" },
                    { width: "30%" },
                    { align: "end", width: "20%" },
                  ]}
                />
              </TableBody>
            </Table>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="비었음">
        <Floor>
          <TableCard title="사용자">
            <Table caption="사용자">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead align="end">남은 휴가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableStatusRow>
                  <ResultSection
                    kind="empty"
                    size="medium"
                    icon={<SearchX />}
                    title="조건에 맞는 사용자가 없어요"
                    secondaryAction={{ label: "필터 초기화", onClick: noop }}
                  />
                </TableStatusRow>
              </TableBody>
            </Table>
          </TableCard>
        </Floor>
      </DemoRow>
      <DemoRow label="실패">
        <Floor>
          <TableCard title="사용자">
            <Table caption="사용자">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead align="end">남은 휴가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableStatusRow>
                  <ResultSection
                    kind="failure"
                    size="medium"
                    icon={<ReceiptText />}
                    title="사용자를 불러오지 못했어요"
                    description="잠시 뒤 다시 시도해 주세요."
                    primaryAction={{ label: "다시 시도", onClick: noop }}
                  />
                </TableStatusRow>
              </TableBody>
            </Table>
          </TableCard>
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="가장 나쁜 값 — 열 여덟 · 긴 셀 · 1억 넘는 금액 · 줄 200 · 상자 안 스크롤 + 머리 고정(가로로도 민다)">
      <DemoRow label="worst">
        <Floor width={760}>
          <WorstDemo />
        </Floor>
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="768 미만 — 표 대신 같은 줄을 List 줄로(첫 열 제목 · 다음 열 설명 · 핵심 값 오른쪽) — 쓰는 쪽이 useTableLayout() 으로 갈라 그린다">
      <DemoRow label="list">
        <Floor width={360}>
          <Card body="list">
            <List aria-label="사용자">
              {USERS.map((u) => (
                <ListButtonItem
                  key={u.id}
                  title={u.name}
                  detail={[u.dept, u.status].join(" · ")}
                  suffix={<span className="tabular-nums">{u.days}</span>}
                  onClick={noop}
                />
              ))}
            </List>
          </Card>
        </Floor>
      </DemoRow>
    </DemoBlock>
  </div>
);
