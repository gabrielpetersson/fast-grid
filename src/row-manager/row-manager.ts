import { Grid } from "../grid";
import { Row } from "../row";
import ViewWorker from "./view-worker?worker";

const viewWorker = new ViewWorker();
console.log(viewWorker);

export type Rows = { [key: number]: Row };

// const prevFilterMs: number[] = [];

// const filterStartTimes: Record<string, number> = {};

export interface Filter {
  type: "string";
  column: number;
  query: string;
}

export interface Sort {
  column: number;
  direction: "ascending" | "descending";
}

export interface View {
  filter: Filter[];
  // TODO(gab): multi column sort
  sort: Sort | null;
  version: number;
}

export interface RowBuffer {
  buffer: Int32Array;
  numRows: number;
}

export interface RowData {
  obj: Rows;
  arr: Row[];
  version: number;
}

export class RowManager {
  rowData: RowData;
  numCols: number;
  grid: Grid;
  view: View;
  currentFilterId: number;
  viewBuffer: RowBuffer;
  noViewBuffer: RowBuffer;
  constructor(grid: Grid, rows: Rows) {
    this.grid = grid;
    this.rowData = { obj: rows, arr: Object.values(rows), version: Date.now() };
    this.numCols = rows[0]?.cells.length ?? 0;

    this.currentFilterId = 0;
    this.view = {
      filter: [],
      sort: null,
      version: Date.now(),
    };

    viewWorker.postMessage({ type: "set-rows", rows });

    const sharedBuffer = new SharedArrayBuffer(
      1_000_000 * Int32Array.BYTES_PER_ELEMENT
    );
    this.viewBuffer = { buffer: new Int32Array(sharedBuffer), numRows: -1 };

    const noFilterBuffer = new Int32Array(
      1_000_000 * Int32Array.BYTES_PER_ELEMENT
    );
    for (const key in rows) {
      noFilterBuffer[key] = Number(key);
    }
    this.noViewBuffer = {
      buffer: noFilterBuffer,
      numRows: Object.values(rows).length,
    };

    viewWorker.onmessage = (event) => {
      switch (event.data.type) {
        case "compute-view-done": {
          console.log("compute view done", event.data.numRows);
          this.viewBuffer.numRows = event.data.numRows;
          this.grid.renderViewportRows();
          this.grid.scrollbar.clampThumbIfNeeded();
          this.grid.renderViewportRows();
          this.grid.renderViewportCells();
          // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
          this.grid.scrollbar.refreshThumb();
          break;
        }
      }
    };
  }
  isView = () => {
    return this.view.filter.length !== 0 || this.view.sort != null;
  };
  getViewBuffer = (): RowBuffer => {
    if (this.isView()) {
      return this.viewBuffer;
    }
    return this.noViewBuffer;
  };
  getNumRows = () => {
    return this.getViewBuffer().numRows;
  };
  setRows = (rows: Rows) => {
    this.rowData = { obj: rows, arr: Object.values(rows), version: Date.now() };

    for (let i = 0; i < this.rowData.arr.length; i++) {
      this.noViewBuffer.buffer[i] = this.rowData.arr[i].key;
    }

    this.noViewBuffer = {
      buffer: this.noViewBuffer.buffer,
      numRows: this.rowData.arr.length,
    };
    this.numCols = this.rowData.arr[0]?.cells.length ?? 0;

    this.grid.scrollbar.setScrollOffsetY(this.grid.offsetY);
    this.grid.scrollbar.setScrollOffsetX(this.grid.offsetX);
    this.grid.renderViewportRows();
    this.grid.scrollbar.refreshThumb();

    // TODO: this is blocking wtf, gotta split this up
    setTimeout(() => {
      const t0 = performance.now();
      viewWorker.postMessage({ type: "set-rows", rows: this.rowData.obj });
      console.log("Ms to send rows to worker", performance.now() - t0);
    });
  };
  // filterBy = async (query: string) => {
  //   const t0 = performance.now();

  //   const computedRows = await (async () => {
  //     if (query == null) {
  //       return { result: null, cancel: false };
  //     }
  //     const filterId = this.currentFilterId + 1;
  //     this.currentFilterId = filterId;
  //     const shouldCancel = () => {
  //       return this.currentFilterId !== filterId;
  //     };
  //     const onEarlyResults = (rows: Row[]) => {
  //       this.computedRows = rows;
  //       this.grid.renderViewportRows();
  //       this.grid.renderViewportCells();
  //       // NOTE(gab): clamps scroll offset into viewport, if rows are filtered away
  //       // TODO(gab): this makes filtering feel snappier but the scrollbar size will jump a bit.
  //       // estimate the scrollbar size instead given how many results we have now and use that instead.
  //       this.grid.scrollbar.clampThumbIfNeeded();
  //     };
  //     const computedRows = await filterRows({
  //       query,
  //       rows: Object.values(this.rows),
  //       rowsPerViewport: this.grid.getState().rowsPerViewport,
  //       onEarlyResults,
  //       shouldCancel,
  //     });
  //     if (computedRows == "canceled") {
  //       return { result: null, cancel: true };
  //     }
  //     return { result: computedRows, cancel: false };
  //   })();

  //   if (computedRows.cancel) {
  //     return;
  //   }
  //   this.computedRows = computedRows.result;

  //   this.grid.scrollbar.clampThumbIfNeeded();
  //   this.grid.renderViewportRows();
  //   this.grid.renderViewportCells();
  //   // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
  //   this.grid.scrollbar.refreshThumb();

  //   const ms = performance.now() - t0;
  //   prevFilterMs.push(ms);
  //   const avgFilterMs =
  //     prevFilterMs.reduce((a, b) => a + b, 0) / prevFilterMs.length;
  //   console.log(`Filtering took ${ms}. Avg: ${avgFilterMs}`);
  // };

  updateFilterOrCreateNew = (query: string) => {
    // TODO(gab): hardcoded to column 2 for now
    const filter = this.view.filter.find((f) => f.column === 2);
    if (filter != null) {
      filter.query = query;
    } else {
      this.view.filter.push({
        type: "string",
        column: 2,
        query,
      });
    }
  };

  multithreadFilterBy = async (query: string) => {
    console.count("----------");
    this.view.version = Date.now();
    if (query === "") {
      const filterIndex = this.view.filter.findIndex((f) => f.column === 2);
      this.view.filter.splice(filterIndex, 1);
      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
      return;
    }

    this.updateFilterOrCreateNew(query);

    viewWorker.postMessage({
      type: "compute-view",
      viewConfig: this.view,
      recompute: {
        filter: true,
        sort: false,
      },
      viewBuffer: this.viewBuffer.buffer,
    });
  };
  multithreadSortBy = async (sort: "ascending" | "descending" | null) => {
    this.view.version = Date.now();
    if (sort == null) {
      this.view.sort = null;
      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
      return;
    }
    this.view.sort = {
      column: 2,
      direction: sort,
    };
    viewWorker.postMessage({
      type: "compute-view",
      viewConfig: this.view,
      recompute: {
        filter: true,
        sort: true,
      },
      viewBuffer: this.viewBuffer.buffer,
    });
  };
}
