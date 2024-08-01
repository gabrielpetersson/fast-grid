import { CELL_WIDTH, Cell, CellComponent } from "./cell";
import { Grid } from "./grid";

export interface Row {
  id: number;
  cells: Cell[];
}

export class RowComponent {
  id: number;
  el: HTMLDivElement;
  cells: Cell[];
  _offset: number;

  cellComponentMap: Record<string, CellComponent>;
  grid: Grid;
  constructor(grid: Grid, id: number, cells: Cell[], _offset: number) {
    this.grid = grid;
    this.id = id;
    this.cells = cells;
    this._offset = _offset;
    this.cellComponentMap = {};

    this.el = document.createElement("div");
    this.el.className = "absolute top-0 h-[32px]";

    this.setOffset(_offset, true);
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
  setOffset(offset: number, force: boolean = false) {
    if (force || offset != this._offset) {
      this.el.style.transform = `translateY(${offset}px)`;
    }
    this._offset = offset;
  }
  renderCells() {
    const state = this.grid.getState();

    const renderCells: Record<string, true> = {};
    for (let i = state.startCell; i < state.endCell; i++) {
      const cell = this.cells[i];
      renderCells[cell.id] = true;
    }

    const removeCells: CellComponent[] = [];
    for (const id in this.cellComponentMap) {
      if (id in renderCells) {
        continue;
      }
      const cell = this.cellComponentMap[id]!;
      removeCells.push(cell);
    }

    for (let i = state.startCell; i < state.endCell; i++) {
      const cell = this.cells[i]!;
      const offset = state.cellOffset + (i - state.startCell) * CELL_WIDTH;

      const existingCell = this.cellComponentMap[cell.id];
      if (existingCell != null) {
        existingCell.setOffset(offset);
        continue;
      }

      const reuseCell = removeCells.pop();
      if (reuseCell != null) {
        delete this.cellComponentMap[reuseCell.cellRef.id];
        reuseCell.setValue(cell);
        reuseCell.setOffset(offset);
        this.cellComponentMap[reuseCell.cellRef.id] = reuseCell;
        continue;
      }

      const newCell = new CellComponent(offset, cell);
      this.el.appendChild(newCell.el);
      this.cellComponentMap[newCell.cellRef.id] = newCell;
    }

    for (const cell of removeCells) {
      delete this.cellComponentMap[cell.cellRef.id];
      this.el.removeChild(cell.el);
    }
  }
}
