import { CELL_WIDTH, Cell, CellComponent } from "./cell";
import { Grid } from "./grid";

export interface Row {
  key: number;
  cells: Cell[];
}

type RowState =
  | { prerender: true; key: number; cells: Cell[] }
  | { prerender: false; key: number; cells: Cell[]; offset: number };

export class RowComponent {
  el: HTMLDivElement;
  rowState: RowState;
  cellComponentMap: Record<string, CellComponent>;

  grid: Grid;
  constructor(grid: Grid, rowState: RowState) {
    this.grid = grid;
    this.rowState = rowState;
    this.cellComponentMap = {};

    this.el = document.createElement("div");
    this.el.className = "absolute top-0 h-[32px]";

    if (rowState.prerender) {
      this.prerenderRow();
    } else {
      this.renderRow(rowState.offset);
    }
    this.renderCells();
  }
  destroy() {
    // TODO(gab): can speed be improved?
    // https://github.com/brianmhunt/knockout-fast-foreach/issues/37
    // TODO(gab): should not need this, but crashes on my other computer otherwise. check
    if (this.grid.container.contains(this.el)) {
      this.grid.container.removeChild(this.el);
    } else {
      console.error("row component already removed");
    }
  }
  setOffset(offset: number) {
    this.el.style.transform = `translateY(${offset}px)`;
  }
  prerenderRow() {
    // TODO(gab): set to negative row height or something
    // should be able to set like this.el.style.contain = "content"; here?
    this.setOffset(-3000);
  }
  renderRow(offset: number) {
    this.setOffset(offset);
  }
  renderCells() {
    const state = this.grid.getState();

    const renderCells: Record<string, true> = {};
    for (let i = state.startCell; i < state.endCell; i++) {
      const cell = this.rowState.cells[i];
      renderCells[cell.key] = true;
    }

    const removeCells: CellComponent[] = [];
    for (const key in this.cellComponentMap) {
      if (key in renderCells) {
        continue;
      }
      const cell = this.cellComponentMap[key]!;
      removeCells.push(cell);
    }

    for (let i = state.startCell; i < state.endCell; i++) {
      const value = this.rowState.cells[i]!;
      const offset = state.cellOffset + (i - state.startCell) * CELL_WIDTH;

      const existingCell = this.cellComponentMap[value.key];
      if (existingCell != null) {
        existingCell.setOffset(offset);
        continue;
      }

      const reuseCell = removeCells.pop();
      if (reuseCell != null) {
        delete this.cellComponentMap[reuseCell.value.key];
        reuseCell.setValue(value, i);
        reuseCell.setOffset(offset);
        this.cellComponentMap[reuseCell.value.key] = reuseCell;
        continue;
      }

      const newCell = new CellComponent(this, value, i);
      this.el.appendChild(newCell.el);
      this.cellComponentMap[newCell.value.key] = newCell;
      newCell.setOffset(offset);
    }

    for (const cell of removeCells) {
      cell.destroy();
      delete this.cellComponentMap[cell.value.key];
    }
  }
  setRowState(rowState: RowState) {
    this.rowState = rowState;
    if (rowState.prerender) {
      this.prerenderRow();
    } else {
      this.renderRow(rowState.offset);
    }
    this.renderCells();
  }
}
