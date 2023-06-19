import { CELL_WIDTH } from "./cell";
import { Row, RowComponent } from "./row";
import { Scrollbar } from "./scrollbar";
import { filterRows } from "./utils/filter";
import { TouchScrolling } from "./utils/touch-scroll";

const ROW_HEIGHT = 32;
const prevFilterMs: number[] = [];
export class Grid {
  offsetY: number;
  offsetX: number;
  rows: Row[];

  windowHeight: number;
  windowWidth: number;

  container: HTMLDivElement;
  rowComponentMap: Record<string, RowComponent>;

  scrollbar: Scrollbar;
  currentFilterId: number;
  filteredRows: Row[] | null;
  constructor(container: HTMLDivElement, rows: Row[]) {
    this.currentFilterId = 0;
    this.filteredRows = null;

    this.offsetY = 0;
    this.offsetX = 0;
    this.rows = rows;
    this.container = container;
    this.rowComponentMap = {};
    this.windowHeight = window.innerHeight;
    this.windowWidth = window.innerWidth;

    this.container = container;
    this.rowComponentMap = {};

    this.scrollbar = new Scrollbar(this);
    new TouchScrolling(this.container);

    window.addEventListener("resize", this.onResizeWindow);
    this.renderViewportRows();
    // TODO(gab): add window resize listener and reset styles
  }
  getState = () => {
    const rows = this.getRows();
    const numCells = rows[0]?.cells.length ?? 0;

    const viewportWidth = this.container.clientWidth;
    const cellsPerRow = Math.floor(viewportWidth / CELL_WIDTH) + 2;
    const tableWidth = numCells * CELL_WIDTH ?? 0;

    const viewportHeight = this.container.clientHeight;
    // NOTE(gab): full viewport, and an additional row top and bottom to simulate scrolling
    const rowsPerViewport = Math.floor(viewportHeight / ROW_HEIGHT) + 2;

    const tableHeight = rows.length * ROW_HEIGHT;

    const startCell = Math.floor(this.offsetX / CELL_WIDTH);
    const endCell = Math.min(startCell + cellsPerRow, numCells);
    const cellOffset = -Math.floor(this.offsetX % CELL_WIDTH);

    // NOTE(gab): start to end of rows to render, along with the row offset to simulate scrolling
    const startRow = Math.floor(this.offsetY / ROW_HEIGHT);
    const endRow = Math.min(startRow + rowsPerViewport, rows.length);
    const rowOffset = -Math.floor(this.offsetY % ROW_HEIGHT);

    const scrollableHeight = Math.max(tableHeight - viewportHeight, 0);
    const scrollThumbYPct =
      tableHeight === 0 ? 100 : viewportHeight / tableHeight;
    const thumbSizeY = Math.max(
      Math.min(scrollThumbYPct * viewportHeight, viewportHeight),
      30
    );
    const thumbOffsetY = (() => {
      if (scrollableHeight === 0) return 0;
      return (
        (this.offsetY / scrollableHeight) * viewportHeight -
        thumbSizeY * (this.offsetY / scrollableHeight)
      );
    })();

    const scrollableWidth = Math.max(tableWidth - viewportWidth, 0);
    const scrollThumbXPct = tableWidth === 0 ? 100 : viewportWidth / tableWidth;
    const thumbSizeX = Math.max(
      Math.min(scrollThumbXPct * viewportWidth, viewportWidth),
      30
    );
    const thumbOffsetX =
      (this.offsetX / scrollableWidth) * viewportWidth -
      thumbSizeX * (this.offsetX / scrollableWidth);
    return {
      endRow,
      startRow,
      rowOffset,

      startCell,
      endCell,
      cellOffset,

      viewportWidth,
      viewportHeight,

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
  getRows = () => {
    if (this.filteredRows != null) {
      return this.filteredRows;
    }
    return this.rows;
  };
  // TODO(gab): move this out from the package
  filterBy = async (query: string) => {
    const t0 = performance.now();

    const filteredRows = await (async () => {
      if (query == null) {
        return { result: null, cancel: false };
      }
      const filterId = this.currentFilterId + 1;
      this.currentFilterId = filterId;
      const shouldCancel = () => {
        return this.currentFilterId !== filterId;
      };
      const onEarlyResults = (rows: Row[]) => {
        this.filteredRows = rows;
        this.renderViewportRows();
        this.renderViewportCells();
        // NOTE(gab): clamps scroll offset into viewport, if rows are filtered away
        // TODO(gab): this makes filtering feel snappier but the scrollbar size will jump a bit.
        // estimate the scrollbar size instead given how many results we have now and use that instead.
        this.scrollbar.setScrollOffset({ x: this.offsetX, y: this.offsetY });
      };
      const filteredRows = await filterRows({
        query,
        rows: this.rows,
        rowsPerViewport: this.getState().rowsPerViewport,
        onEarlyResults,
        shouldCancel,
      });
      if (filteredRows == "canceled") {
        return { result: null, cancel: true };
      }
      return { result: filteredRows, cancel: false };
    })();

    if (filteredRows.cancel) {
      return;
    }
    this.filteredRows = filteredRows.result;

    this.scrollbar.setScrollOffset({ x: this.offsetX, y: this.offsetY });
    this.renderViewportRows();
    this.renderViewportCells();
    // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
    this.scrollbar.refreshThumb();

    const ms = performance.now() - t0;
    prevFilterMs.push(ms);
    const avgFilterMs =
      prevFilterMs.reduce((a, b) => a + b, 0) / prevFilterMs.length;
    console.log(`Filtering took ${ms}. Avg: ${avgFilterMs}`);
  };
  setRows = (rows: Row[]) => {
    this.rows = rows;
    this.filteredRows = null;
    this.scrollbar.setScrollOffset({ y: this.offsetY });
    this.renderViewportRows();
    this.scrollbar.refreshThumb();
  };
  // TODO(gab): make readable
  renderViewportRows = () => {
    const state = this.getState();
    const rows = this.getRows();
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
    const rows = this.getRows();
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
    this.scrollbar.setScrollOffset({ x: this.offsetX, y: this.offsetY });
    this.renderViewportRows();
    this.renderViewportCells();
    this.scrollbar.refreshThumb();
  };
}
