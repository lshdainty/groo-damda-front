export interface ExpenseSplit {
  rowId: number;
  expenseRowId: number;
  categoryRowId: number;
  categoryName: string;
  amount: number;
  label: string | null;
  sortOrder: number;
  createAt: string;
  modifyAt: string;
}

export interface ExpenseSplitFormValue {
  /** 저장된 항목이면 그 rowId — 보내면 서버가 제자리 수정한다(없으면 새로 만든다) */
  rowId?: number;
  categoryRowId: number;
  amount: number;
  label?: string | null;
  sortOrder?: number;
}
