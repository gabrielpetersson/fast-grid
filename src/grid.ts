import { isTimeToYield, yieldControl } from "main-thread-scheduling";
import { CELL_WIDTH } from "./cell";
import { Row, RowComponent } from "./row";
import { Scrollbar } from "./scrollbar";

const ROW_HEIGHT = 32;

export class Grid {
  scrollOffsetY: number;
  scrollOffsetX: number;
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

    this.scrollOffsetY = 0;
    this.scrollOffsetX = 0;
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
    // NOTE(gab): full viewport + 1 row above and one under
    const rowsPerViewport = Math.floor(viewportHeight / ROW_HEIGHT) + 2;

    const requiredHeight = Math.max(rows.length * ROW_HEIGHT, viewportHeight);

    const startCell = Math.floor(this.scrollOffsetX / CELL_WIDTH);
    const endCell = Math.min(startCell + cellsPerRow, numCells);
    const cellOffset = -Math.floor(this.scrollOffsetX % CELL_WIDTH);

    const startRow = Math.floor(this.scrollOffsetY / ROW_HEIGHT);
    const endRow = Math.min(startRow + rowsPerViewport, rows.length);
    const rowOffset = -Math.floor(this.scrollOffsetY % ROW_HEIGHT);

    const missingHeight = requiredHeight - viewportHeight;
    const scrollThumbYPct =
      missingHeight === 0 ? 1 : viewportHeight / missingHeight;
    const scrollThumbYSize = Math.max(
      Math.min(scrollThumbYPct * viewportHeight, viewportHeight),
      30
    );
    // TODO(gab): JESUS CHRIST fix naming
    const scrollYOffset =
      (this.scrollOffsetY / missingHeight) * viewportHeight -
      scrollThumbYSize * (this.scrollOffsetY / missingHeight);

    const missingWidth = Math.max(requiredWidth - viewportWidth, 0);
    const scrollThumbXPct = viewportWidth / requiredWidth;
    const scrollThumbXSize = Math.max(
      Math.min(scrollThumbXPct * viewportWidth, viewportWidth),
      30
    );
    const scrollXOffset =
      (this.scrollOffsetX / missingWidth) * viewportWidth -
      scrollThumbXSize * (this.scrollOffsetX / missingWidth);
    return {
      endRow,
      startRow,
      rowOffset,

      startCell,
      endCell,
      cellOffset,

      viewportWidth,
      viewportHeight,

      missingHeight,
      requiredHeight,
      scrollYOffset,
      scrollThumbYSize,

      missingWidth,
      requiredWidth,
      scrollXOffset,
      scrollThumbXSize,
    };
  };
  setScrollOffsetX = (offset: number) => {
    this.scrollOffsetX = offset;
    const metrics = this.getMetrics();
    this.scrollbar.setOffsetY(metrics.scrollYOffset);
    this.renderViewportRows();
  };
  scrollToBottom = () => {
    const metrics = this.getMetrics();
    this.scrollbar.setScrollOffsetY(metrics.missingHeight);
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

    const ROW_CHUNK_SIZE = 1000;
    const filteredRows: Row[] = [];
    const numChunks = Math.ceil(this.rows.length / ROW_CHUNK_SIZE);

    const filterId = this.currentFilterId + 1;
    this.currentFilterId = filterId;

    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const startIndex = chunkIndex * ROW_CHUNK_SIZE;
      const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, this.rows.length);

      if (isTimeToYield("user-visible")) {
        await yieldControl("user-visible");
        if (this.shouldCancelFilter(filterId)) {
          return;
        }
      }

      for (let i = startIndex; i < endIndex; i++) {
        const row = this.rows[i]!;
        if (row.cells[1]!.value.includes(query)) {
          filteredRows.push(row);
        }
      }

      if (
        chunkIndex % 200 === 0 ||
        chunkIndex === 0 ||
        chunkIndex === numChunks - 1
      ) {
        // experimental, sets the filtered results every batch.
        // will loose track of where you previously were, instantly gives results
        this.filteredRows = filteredRows;
        this.renderViewportRows();
        // hack for scrolling to closest non-filtered row
        this.scrollbar.setScrollOffsetY(this.scrollOffsetY);
        this.scrollbar.updateUi();
      }
    }
  };
  setRows = (rows: Row[]) => {
    this.rows = rows;
    this.filteredRows = null;
    this.scrollbar.setScrollOffsetY(this.scrollOffsetY);
    this.scrollbar.updateUi();
    this.renderViewportRows();
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
  renderViewportCells = () => {
    const metrics = this.getMetrics();

    for (let i = metrics.startRow; i < metrics.endRow; i++) {
      const row = this.getRows()[i]!;
      if (row == null) {
        continue;
      }
      const existing = this.rowComponentMap[row.key];
      if (existing == null) {
        throw new Error("should exist");
      }
      existing.renderCells();
    }
  };
}
