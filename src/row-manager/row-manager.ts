import { Grid } from "../grid";
import { Row } from "../row";
import { isEmptyFast } from "../utils/is-empty-fast";
import { ComputeViewEvent, SetRowsEvent } from "./view-worker";
import ViewWorker from "./view-worker?worker&inline";

const viewWorker = new ViewWorker();

export type Rows = { [id: number]: Row };

// const prevFilterMs: number[] = [];

// const filterStartTimes: Record<string, number> = {};

type ColumnIndex = number;
export interface View {
  filter: Record<ColumnIndex, string>;
  sort: { direction: "ascending" | "descending"; column: ColumnIndex }[]; // is applied in order
  version: number;
}

export interface RowBuffer {
  buffer: Int32Array;
  numRows: number;
}

export interface RowData {
  // duplicate the data so we can access it quickly, both arr & map
  obj: Rows;
  arr: Row[];
  version: number;
}

export class RowManager {
  rowData: RowData;
  grid: Grid;
  view: View;

  isViewResult: boolean = false;
  currentFilterId: number;
  viewBuffer: RowBuffer;
  noViewBuffer: RowBuffer;
  constructor(grid: Grid, rows: Rows) {
    this.grid = grid;
    this.rowData = { obj: rows, arr: Object.values(rows), version: Date.now() };

    this.currentFilterId = 0;
    this.view = {
      filter: {},
      sort: [],
      version: Date.now(),
    };

    viewWorker.postMessage({ type: "set-rows", rows } satisfies SetRowsEvent);

    const sharedBuffer = new SharedArrayBuffer(
      1_000_000 * Int32Array.BYTES_PER_ELEMENT
    );
    this.viewBuffer = { buffer: new Int32Array(sharedBuffer), numRows: -1 };

    // EHHH this is very dumb, just unifying my array buffer interface between views and not views.. which should just be an iterable index
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
          const updateThumb = event.data.skipRefreshThumb !== true;
          this.viewBuffer.numRows = event.data.numRows;
          this.isViewResult = true;
          this.grid.renderViewportRows();

          if (updateThumb) {
            this.grid.scrollbar.clampThumbIfNeeded();
          }

          this.grid.renderViewportRows();
          this.grid.renderViewportCells();
          if (updateThumb) {
            this.grid.scrollbar.refreshThumb();
          }
          // NOTE(gab): refresh size of thumb after completely done filtering, to prevent jumping of size
          break;
        }
      }
    };
  }
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
  setRows = (rows: Rows, skipSendToWorker: boolean = false) => {
    this.rowData = { obj: rows, arr: Object.values(rows), version: Date.now() };

    for (let i = 0; i < this.rowData.arr.length; i++) {
      this.noViewBuffer.buffer[i] = this.rowData.arr[i].id;
    }

    this.noViewBuffer = {
      buffer: this.noViewBuffer.buffer,
      numRows: this.rowData.arr.length,
    };

    this.grid.scrollbar.setScrollOffsetY(this.grid.offsetY);
    this.grid.scrollbar.setScrollOffsetX(this.grid.offsetX);
    this.grid.renderViewportRows();
    this.grid.scrollbar.refreshThumb();

    if (!skipSendToWorker) {
      // TODO: this is blocking wtf, gotta split this up

      const t0 = performance.now();
      viewWorker.postMessage({
        type: "set-rows",
        rows: this.rowData.obj,
      } satisfies SetRowsEvent);
      console.log("Ms to send rows to worker", performance.now() - t0);
    }
  };
  isViewEmpty = () => {
    return isEmptyFast(this.view.filter) && isEmptyFast(this.view.sort);
  };
  runFilter = async () => {
    console.count("---------- start filter");
    this.view.version = Date.now();

    if (this.isViewEmpty()) {
      this.isViewResult = false;
      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
    } else {
      viewWorker.postMessage({
        type: "compute-view",
        viewConfig: this.view,
        viewBuffer: this.viewBuffer.buffer,
        useSortCache: true,
      } satisfies ComputeViewEvent);
    }
  };
  runSort = async () => {
    console.count("---------- start sort");
    this.view.version = Date.now();

    if (this.isViewEmpty()) {
      this.isViewResult = false;
      this.grid.renderViewportRows();
      this.grid.renderViewportCells();
      this.grid.scrollbar.refreshThumb();
    } else {
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
