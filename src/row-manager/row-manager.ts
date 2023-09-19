import { Grid } from "../grid";
import { Row } from "../row";
import { filterRows } from "../utils/filter";

const prevFilterMs: number[] = [];
export class RowManager {
  rows: Row[];
  computedRows: Row[] | null;
  grid: Grid;
  currentFilterId: number;
  constructor(grid: Grid, rows: Row[]) {
    this.grid = grid;
    this.rows = rows;
    this.computedRows = null;
    this.currentFilterId = 0;
  }
  getRows = () => {
    if (this.computedRows != null) {
      return this.computedRows;
    }
    return this.rows;
  };

  filterBy = async (query: string) => {
    const t0 = performance.now();

    const computedRows = await (async () => {
      if (query == null) {
        return { result: null, cancel: false };
      }
      const filterId = this.currentFilterId + 1;
      this.currentFilterId = filterId;
      const shouldCancel = () => {
        return this.currentFilterId !== filterId;
      };
      const onEarlyResults = (rows: Row[]) => {
        this.computedRows = rows;
        this.grid.renderViewportRows();
        this.grid.renderViewportCells();
        // NOTE(gab): clamps scroll offset into viewport, if rows are filtered away
        // TODO(gab): this makes filtering feel snappier but the scrollbar size will jump a bit.
        // estimate the scrollbar size instead given how many results we have now and use that instead.
        this.grid.scrollbar.clampThumbIfNeeded({
          x: this.grid.offsetX,
          y: this.grid.offsetY,
        });
      };
      const computedRows = await filterRows({
        query,
        rows: this.rows,
        rowsPerViewport: this.grid.getState().rowsPerViewport,
        onEarlyResults,
        shouldCancel,
      });
      if (computedRows == "canceled") {
        return { result: null, cancel: true };
      }
      return { result: computedRows, cancel: false };
    })();

    if (computedRows.cancel) {
      return;
    }
    this.computedRows = computedRows.result;

    this.grid.scrollbar.clampThumbIfNeeded({
      x: this.grid.offsetX,
      y: this.grid.offsetY,
    });
    this.grid.renderViewportRows();
    this.grid.renderViewportCells();
    // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
    this.grid.scrollbar.refreshThumb();

    const ms = performance.now() - t0;
    prevFilterMs.push(ms);
    const avgFilterMs =
      prevFilterMs.reduce((a, b) => a + b, 0) / prevFilterMs.length;
    console.log(`Filtering took ${ms}. Avg: ${avgFilterMs}`);
  };
}
