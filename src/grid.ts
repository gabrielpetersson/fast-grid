import { CELL_WIDTH } from "./cell";
import { Row, RowComponent } from "./row";
import { RowManager } from "./row-manager/row-manager";
import { Scrollbar } from "./scrollbar";
import { TouchScrolling } from "./utils/touch-scroll";

const ROW_HEIGHT = 32;

interface GridState {
  endRow: number;
  startRow: number;
  rowOffset: number;

  startCell: number;
  endCell: number;
  cellOffset: number;

  scrollableHeight: number;
  tableHeight: number;
  thumbOffsetY: number;
  thumbSizeY: number;

  scrollableWidth: number;
  tableWidth: number;
  thumbOffsetX: number;
  thumbSizeX: number;

  rowsPerViewport: number;
  cellsPerRow: number;
}

export class Grid {
  state: GridState;

  offsetY: number;
  offsetX: number;

  windowHeight: number;
  windowWidth: number;

  container: HTMLDivElement;
  rowComponentMap: Record<string, RowComponent>;

  scrollbar: Scrollbar;
  rowManager: RowManager;

  viewportWidth: number;
  viewportHeight: number;
  constructor(container: HTMLDivElement, rows: Row[]) {
    this.container = container;
    this.rowManager = new RowManager(this, rows);

    this.viewportWidth = this.container.clientWidth;
    this.viewportHeight = this.container.clientHeight;
    this.state = this.getState();

    this.offsetY = 0;
    this.offsetX = 0;

    this.rowComponentMap = {};
    this.windowHeight = window.innerHeight;
    this.windowWidth = window.innerWidth;

    this.rowComponentMap = {};

    this.scrollbar = new Scrollbar(this);
    new TouchScrolling(this.container);

    window.addEventListener("resize", this.onResizeWindow);
    this.renderViewportRows();
  }
  getState = (): GridState => {
    const rows = this.rowManager.getRows();
    let numCells: number;
    // console.log(rows);
    if (rows.length === 0) {
      numCells = 0;
    } else {
      numCells = rows[0].cells.length;
    }

    const cellsPerRow = Math.floor(this.viewportWidth / CELL_WIDTH) + 2;
    const tableWidth = numCells * CELL_WIDTH ?? 0;

    // NOTE(gab): full viewport, and an additional row top and bottom to simulate scrolling
    const rowsPerViewport = Math.floor(this.viewportHeight / ROW_HEIGHT) + 2;

    const tableHeight = rows.length * ROW_HEIGHT;

    const startCell = Math.floor(this.offsetX / CELL_WIDTH);
    const endCell = Math.min(startCell + cellsPerRow, numCells);
    const cellOffset = -Math.floor(this.offsetX % CELL_WIDTH);

    // NOTE(gab): start to end of rows to render, along with the row offset to simulate scrolling
    const startRow = Math.floor(this.offsetY / ROW_HEIGHT);
    const endRow = Math.min(startRow + rowsPerViewport, rows.length);
    const rowOffset = -Math.floor(this.offsetY % ROW_HEIGHT);

    const scrollableHeight = Math.max(tableHeight - this.viewportHeight, 0);

    const asymptoticValue = (): number => {
      const minThumbSize = 4.1; // Slightly above 4%

      let ratio = this.viewportHeight / tableHeight;
      const factor = 50; // Adjust this value to change the curve of the function.

      let scrollbarThumbPercentHeightOfViewport =
        100 *
        (minThumbSize / 100 +
          (1 - minThumbSize / 100) / (1 + factor * Math.log(1 + 1 / ratio)));

      scrollbarThumbPercentHeightOfViewport = Math.max(
        scrollbarThumbPercentHeightOfViewport,
        minThumbSize
      ); // Ensure it doesn't go below our minimum
      return Math.min(100, scrollbarThumbPercentHeightOfViewport) / 100;
    };

    const scrollThumbYPct = tableHeight === 0 ? 1 : asymptoticValue(); //this.viewportHeight / tableHeight
    const thumbSizeY = Math.round(
      Math.max(
        Math.min(scrollThumbYPct * this.viewportHeight, this.viewportHeight),
        30
      )
    );

    let thumbOffsetY: number;
    if (scrollableHeight === 0) {
      thumbOffsetY = 0;
    } else {
      thumbOffsetY =
        (this.offsetY / scrollableHeight) * this.viewportHeight -
        thumbSizeY * (this.offsetY / scrollableHeight);
    }

    const scrollableWidth = Math.max(tableWidth - this.viewportWidth, 0);
    const scrollThumbXPct =
      tableWidth === 0 ? 100 : this.viewportWidth / tableWidth;

    const thumbSizeX = Math.round(
      Math.max(
        Math.min(scrollThumbXPct * this.viewportWidth, this.viewportWidth),
        30
      )
    );
    const thumbOffsetX =
      (this.offsetX / scrollableWidth) * this.viewportWidth -
      thumbSizeX * (this.offsetX / scrollableWidth);

    // todo: a bit dumb will fix. anyway fixes GC
    if (this.state != null) {
      this.state.endRow = endRow;
      this.state.startRow = startRow;
      this.state.rowOffset = rowOffset;

      this.state.startCell = startCell;
      this.state.endCell = endCell;
      this.state.cellOffset = cellOffset;

      this.state.scrollableHeight = scrollableHeight;
      this.state.tableHeight = tableHeight;
      this.state.thumbOffsetY = thumbOffsetY;
      this.state.thumbSizeY = thumbSizeY;

      this.state.scrollableWidth = scrollableWidth;
      this.state.tableWidth = tableWidth;
      this.state.thumbOffsetX = thumbOffsetX;
      this.state.thumbSizeX = thumbSizeX;

      this.state.rowsPerViewport = rowsPerViewport;
      this.state.cellsPerRow = cellsPerRow;
      return this.state;
    }
    return {
      endRow,
      startRow,
      rowOffset,

      startCell,
      endCell,
      cellOffset,

      scrollableHeight,
      tableHeight,
      thumbOffsetY,
      thumbSizeY,

      scrollableWidth,
      tableWidth,
      thumbOffsetX,
      thumbSizeX,

      rowsPerViewport,
      cellsPerRow,
    };
  };
  scrollToBottom = () => {
    const state = this.getState();
    this.scrollbar.setScrollOffset({ y: state.scrollableHeight });
    this.renderViewportRows();
  };
  setRows = (rows: Row[]) => {
    this.rowManager.rows = rows;
    this.rowManager.computedRows = rows;
    this.scrollbar.setScrollOffset({ y: this.offsetY });
    this.renderViewportRows();
    this.scrollbar.refreshThumb();
  };
  // TODO(gab): make readable
  renderViewportRows = () => {
    const state = this.getState();
    const rows = this.rowManager.getRows();
    const renderRows: Record<string, true> = {};
    for (let i = state.startRow; i < state.endRow; i++) {
      const row = rows[i];
      if (row == null) {
        continue;
      }
      renderRows[row.key] = true;
    }

    const removeRows: RowComponent[] = [];
    for (const key in this.rowComponentMap) {
      if (key in renderRows) {
        continue;
      }
      const rowComponent = this.rowComponentMap[key]!;
      removeRows.push(rowComponent);
    }

    for (let i = state.startRow; i < state.endRow; i++) {
      const row = rows[i];
      if (row == null) {
        continue;
      }

      const offset = state.rowOffset + (i - state.startRow) * ROW_HEIGHT;
      const existingRow = this.rowComponentMap[row.key];
      if (existingRow != null) {
        existingRow.setOffset(offset);
        continue;
      }

      const reuseRow = removeRows.pop();
      if (reuseRow != null) {
        delete this.rowComponentMap[reuseRow.rowState.key];
        reuseRow.setRowState({
          key: row.key,
          prerender: false,
          offset,
          cells: row.cells,
        });
        this.rowComponentMap[row.key] = reuseRow;
        continue;
      }

      const rowComponent = new RowComponent(this, {
        key: row.key,
        prerender: false,
        offset,
        cells: row.cells,
      });
      this.container.appendChild(rowComponent.el);
      this.rowComponentMap[row.key] = rowComponent;
    }

    for (const row of removeRows) {
      row.destroy();
      delete this.rowComponentMap[row.rowState.key];
    }
  };
  renderViewportCells = () => {
    const state = this.getState();
    const rows = this.rowManager.getRows();
    for (let i = state.startRow; i < state.endRow; i++) {
      const row = rows[i]!;
      const rowComponent = this.rowComponentMap[row.key];
      if (rowComponent == null) {
        throw new Error("should exist. did you render rows first?");
      }
      rowComponent.renderCells();
    }
  };
  onResizeWindow = () => {
    this.viewportWidth = this.container.clientWidth;
    this.viewportHeight = this.container.clientHeight;
    this.scrollbar.setScrollOffset({ x: this.offsetX, y: this.offsetY });
    this.renderViewportRows();
    this.renderViewportCells();
    this.scrollbar.refreshThumb();
  };
}
