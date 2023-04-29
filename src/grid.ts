import { isTimeToYield, yieldControl } from "main-thread-scheduling";
import { CELL_WIDTH } from "./cell";
import { Row, RowComponent } from "./row";
import { Scrollbar } from "./scrollbar";

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

    this.renderViewportRows();
    // TODO(gab): add window resize listener and reset styles
  }
  getMetrics = () => {
    const rows = this.getRows();
    const numCells = rows[0]?.cells.length ?? 0;

    const viewportWidth = this.container.clientWidth;
    const cellsPerRow = Math.floor(viewportWidth / CELL_WIDTH) + 2;
    const requiredWidth = Math.max(numCells * CELL_WIDTH ?? 0, viewportWidth);

    const viewportHeight = this.container.clientHeight;
    // NOTE(gab): full viewport, and an additional row top and bottom to simulate scrolling
    const rowsPerViewport = Math.floor(viewportHeight / ROW_HEIGHT) + 2;

    const requiredHeight = Math.max(rows.length * ROW_HEIGHT, viewportHeight);

    const startCell = Math.floor(this.offsetX / CELL_WIDTH);
    const endCell = Math.min(startCell + cellsPerRow, numCells);
    const cellOffset = -Math.floor(this.offsetX % CELL_WIDTH);

    // NOTE(gab): start to end of rows to render, along with the row offset to simulate scrolling
    const startRow = Math.floor(this.offsetY / ROW_HEIGHT);
    const endRow = Math.min(startRow + rowsPerViewport, rows.length);
    const rowOffset = -Math.floor(this.offsetY % ROW_HEIGHT);

    const scrollableHeight = requiredHeight - viewportHeight;
    const scrollThumbYPct = viewportHeight / requiredHeight;
    const thumbSizeY = Math.max(
      Math.min(scrollThumbYPct * viewportHeight, viewportHeight),
      30
    );

    const thumbOffsetY =
      (this.offsetY / scrollableHeight) * viewportHeight -
      thumbSizeY * (this.offsetY / scrollableHeight);

    const scrollableWidth = Math.max(requiredWidth - viewportWidth, 0);
    const scrollThumbXPct = viewportWidth / requiredWidth;
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
      requiredHeight,
      thumbOffsetY,
      thumbSizeY,

      scrollableWidth,
      requiredWidth,
      thumbOffsetX,
      thumbSizeX,

      rowsPerViewport,
      cellsPerRow,
    };
  };
  scrollToBottom = () => {
    const metrics = this.getMetrics();
    this.scrollbar.setScrollOffsetY(metrics.scrollableHeight);
    this.renderViewportRows();
  };
  getRows = () => {
    if (this.filteredRows != null) {
      return this.filteredRows;
    }
    return this.rows;
  };
  shouldCancelFilter = (id: number) => {
    return this.currentFilterId !== id;
  };
  // TODO(gab): move this out from the package
  filterBy = async (query: string) => {
    if (query === "") {
      this.filteredRows = null;
      this.renderViewportRows();
      return;
    }

    const t0 = performance.now();
    const metrics = this.getMetrics();

    const ROW_CHUNK_SIZE = 500;
    const filteredRows: Row[] = [];
    const numChunks = Math.ceil(this.rows.length / ROW_CHUNK_SIZE);

    const filterId = this.currentFilterId + 1;
    this.currentFilterId = filterId;

    let hasShownInitialResult = false;
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const startIndex = chunkIndex * ROW_CHUNK_SIZE;
      const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, this.rows.length);

      if (this.shouldCancelFilter(filterId)) {
        return;
      }
      if (isTimeToYield("user-visible")) {
        await yieldControl("user-visible");
        if (this.shouldCancelFilter(filterId)) {
          return;
        }
      }

      for (let i = startIndex; i < endIndex; i++) {
        const row = this.rows[i]!;
        // NOTE(gab): indexOf is faster than includes
        if (row.cells[1]!.value.indexOf(query) > -1) {
          filteredRows.push(row);
        }
      }

      // NOTE(gab): shows first results asap, but make sure they fill the viewport so rows are
      // not loading in in batches
      const showFirstResult =
        !hasShownInitialResult &&
        filteredRows.length > metrics.rowsPerViewport * 5;
      if (
        chunkIndex % 1000 === 0 ||
        showFirstResult ||
        chunkIndex === numChunks - 1
      ) {
        hasShownInitialResult = true;
        this.filteredRows = filteredRows;

        // clamps offset into viewport, if rows are filtered away
        this.scrollbar.setScrollOffsetY(this.offsetY);
        this.renderViewportRows();
      }
      // NOTE(gab): refresh size of thumb after we are completely done, to prevent jumping
      this.scrollbar.refreshThumb();
    }
    const ms = performance.now() - t0;
    prevFilterMs.push(ms);
    const avgFilterMs =
      prevFilterMs.reduce((a, b) => a + b, 0) / prevFilterMs.length;
    console.log(`Filtering took ${ms}. Avg: ${avgFilterMs}`);
  };
  setRows = (rows: Row[]) => {
    this.rows = rows;
    this.filteredRows = null;
    this.scrollbar.setScrollOffsetY(this.offsetY);
    this.renderViewportRows();
    this.scrollbar.refreshThumb();
  };
  // TODO(gab): make readable
  renderViewportRows = () => {
    const metrics = this.getMetrics();

    const rows = this.getRows();
    const renderedRowMap: Record<string, true> = {};
    for (let i = metrics.startRow; i < metrics.endRow; i++) {
      const row = rows[i];
      if (row == null) {
        continue;
      }
      renderedRowMap[row.key] = true;
    }

    const removeRowComponents: RowComponent[] = [];
    for (const key in this.rowComponentMap) {
      if (key in renderedRowMap) {
        continue;
      }
      const rowComponent = this.rowComponentMap[key]!;
      removeRowComponents.push(rowComponent);
    }

    for (let i = metrics.startRow; i < metrics.endRow; i++) {
      const row = rows[i]!;
      const offset = metrics.rowOffset + (i - metrics.startRow) * ROW_HEIGHT;

      if (row == null) {
        continue;
      }
      const existing = this.rowComponentMap[row.key];
      if (existing != null) {
        existing.setOffset(offset);
        continue;
      }

      const reuseRowComponent = removeRowComponents.pop();
      if (reuseRowComponent != null) {
        delete this.rowComponentMap[reuseRowComponent.rowState.key];
        reuseRowComponent.setRowState({
          key: row.key,
          prerender: false,
          offset,
          cells: row.cells,
        });
        this.rowComponentMap[row.key] = reuseRowComponent;
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

    for (const rowComponent of removeRowComponents) {
      rowComponent.destroy();
      delete this.rowComponentMap[rowComponent.rowState.key];
    }
  };
}
