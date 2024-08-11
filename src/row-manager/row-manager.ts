import { Grid } from "../grid";
import { Row } from "../row";
import { ComputeViewEvent, SetRowsEvent } from "./view-worker";
import ViewWorker from "./view-worker?worker";

const viewWorker = new ViewWorker();

export type Rows = { [id: number]: Row };

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

  isViewResult: boolean = false;
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

    viewWorker.postMessage({ type: "set-rows", rows } satisfies SetRowsEvent);

    const sharedBuffer = new SharedArrayBuffer(
      1_000_000 * Int32Array.BYTES_PER_ELEMENT
    );
    this.viewBuffer = { buffer: new Int32Array(sharedBuffer), numRows: -1 };

    // idk what im doing here, unifying the interface so if i have no view i also use a shared array buffer which is just a [0, 1, 2, 3, ...] index??
    const noViewBuffer = new Int32Array(
      1_000_000 * Int32Array.BYTES_PER_ELEMENT
    );
    for (const id in rows) {
      noViewBuffer[id] = Number(id);
    }
    this.noViewBuffer = {
      buffer: noViewBuffer,
      numRows: Object.values(rows).length,
    };

    viewWorker.onmessage = (event: MessageEvent<ComputeViewDoneEvent>) => {
      switch (event.data.type) {
        case "compute-view-done": {
          this.viewBuffer.numRows = event.data.numRows;
          this.isViewResult = true;
          this.grid.renderViewportRows();

          if (event.data.skipRefreshThumb === true) {
            this.grid.scrollbar.clampThumbIfNeeded();
          }

          this.grid.renderViewportRows();
          this.grid.renderViewportCells();
          if (event.data.skipRefreshThumb === true) {
            this.grid.scrollbar.refreshThumb();
          }
          // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
          break;
        }
      }
    };
  }
  // isViewResult = () => {
  //   return this.view.filter.length !== 0 || this.view.sort != null;
  // };
  reverse = () => {
    for (let i = this.rowData.arr.length - 1; i >= 0; i--) {
      this.noViewBuffer.buffer[i] =
        this.rowData.arr[this.rowData.arr.length - 1 - i].id;
    }
  };
  getViewBuffer = (): RowBuffer => {
    if (this.isViewResult) {
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
      this.noViewBuffer.buffer[i] = this.rowData.arr[i].id;
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
      viewWorker.postMessage({
        type: "set-rows",
        rows: this.rowData.obj,
      } satisfies SetRowsEvent);
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

  isViewEmpty = () => {
    return this.view.filter.length === 0 && this.view.sort == null;
  };

  updateFilterOrCreateNew = (query: string) => {
    const filter = this.view.filter.find((f) => f.column === FILTER_COL);
    if (filter != null) {
      filter.query = query;
    } else {
      this.view.filter.push({
        type: "string",
        column: FILTER_COL,
        query,
      });
    }
  };

  multithreadFilterBy = async (query: string) => {
    console.count("---------- start filter");
    this.view.version = Date.now();
    if (query === "") {
      // hack for only filtering one col for now
      const filterIndex = this.view.filter.findIndex(
        (f) => f.column === FILTER_COL
      );
      this.view.filter.splice(filterIndex, 1);
      // ----------------

      if (this.isViewEmpty()) {
        this.isViewResult = false;
      }

      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
    } else {
      this.updateFilterOrCreateNew(query);
    }

    if (!this.isViewEmpty()) {
      viewWorker.postMessage({
        type: "compute-view",
        viewConfig: this.view,
        viewBuffer: this.viewBuffer.buffer,
        useSortCache: true,
      } satisfies ComputeViewEvent);
    }
  };
  multithreadSortBy = async (sort: "ascending" | "descending" | null) => {
    console.count("---------- start sort");
    this.view.version = Date.now();
    if (sort == null) {
      this.view.sort = null;
      console.log(
        "sort null",
        this.isViewEmpty(),
        this.view.filter,
        this.view.sort
      );
      if (this.isViewEmpty()) {
        this.isViewResult = false;
      }

      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
    } else {
      this.view.sort = {
        column: SORT_COL,
        direction: sort,
      };
    }
    if (!this.isViewEmpty()) {
      viewWorker.postMessage({
        type: "compute-view",
        viewConfig: this.view,
        viewBuffer: this.viewBuffer.buffer,
      } satisfies ComputeViewEvent);
    }
  };
}

export type ComputeViewDoneEvent = {
  type: "compute-view-done";
  numRows: number;
  skipRefreshThumb?: boolean;
};

// temporary while i dont have multi column views. these are  columnindexes to be computed for sort/filter
export const FILTER_COL = 1;
export const SORT_COL = 1;
