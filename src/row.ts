import { CELL_WIDTH, Cell, CellComponent } from "./cell";
import { Grid } from "./grid";

export interface Row {
  key: string;
  cells: Cell[];
}

type RowState =
  | { prerender: true; key: string; cells: Cell[] }
  | { prerender: false; key: string; cells: Cell[]; offset: number };

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
    this.grid.container.removeChild(this.el);
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
    const metrics = this.grid.getMetrics();

    const renderedCellMap: Record<string, true> = {};
    for (let i = metrics.startCell; i < metrics.endCell; i++) {
      const cell = this.rowState.cells[i]!;
      renderedCellMap[cell.key] = true;
    }

    const removeCellComponents: CellComponent[] = [];
    for (const key in this.cellComponentMap) {
      if (key in renderedCellMap) {
        continue;
      }
      const cellComponent = this.cellComponentMap[key]!;
      removeCellComponents.push(cellComponent);
    }

    for (let i = metrics.startCell; i < metrics.endCell; i++) {
      const value = this.rowState.cells[i]!;
      const offset = metrics.cellOffset + (i - metrics.startCell) * CELL_WIDTH;

      const existing = this.cellComponentMap[value.key];
      if (existing != null) {
        existing.setOffset(offset);
        continue;
      }

      const reuseCellComponent = removeCellComponents.pop();
      if (reuseCellComponent != null) {
        delete this.cellComponentMap[reuseCellComponent.value.key];
        reuseCellComponent.setValue(value);
        reuseCellComponent.setOffset(offset);
        this.cellComponentMap[reuseCellComponent.value.key] =
          reuseCellComponent;
        continue;
      }

      const cellComponent = new CellComponent(this, value);
      this.el.appendChild(cellComponent.el);
      this.cellComponentMap[cellComponent.value.key] = cellComponent;
      cellComponent.setOffset(offset);
    }

    for (const cellComponent of removeCellComponents) {
      cellComponent.destroy();
      delete this.cellComponentMap[cellComponent.value.key];
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
