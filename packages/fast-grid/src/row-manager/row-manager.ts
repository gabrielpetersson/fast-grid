import { Grid } from "../grid";
import { Row } from "../row";
import { isEmptyFast } from "../utils/is-empty-fast";
import { ComputeViewEvent, SetRowsEvent } from "./view-worker";
// @ts-expect-error
import ViewWorker from "./view-worker?worker&inline";

const viewWorker = new ViewWorker();

export type Rows = Row[];

// const prevFilterMs: number[] = [];

// const filterStartTimes: Record<string, number> = {};

type ColumnIndex = number;
export type View = {
  filter: Record<ColumnIndex, string>;
  sort: { direction: "ascending" | "descending"; column: ColumnIndex }[]; // is applied in order
  version: number;
};

export type RowBuffer = {
  buffer: Int32Array;
  numRows: number;
};

export class RowManager {
  rows: Rows;
  grid: Grid;
  view: View;

  isViewResult: boolean = false;
  currentFilterId: number;
  viewBuffer: RowBuffer;
  constructor(grid: Grid, rows: Rows) {
    this.grid = grid;
    this.rows = rows;

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
  getViewBuffer = (): RowBuffer | null => {
    if (this.isViewResult) {
      return this.viewBuffer;
    }
    return null;
  };
  getNumRows = () => {
    const viewBuffer = this.getViewBuffer();
    if (viewBuffer == null) {
      return this.rows.length;
    }
    return viewBuffer.numRows;
  };
  setRows = (rows: Rows, skipSendToWorker: boolean = false) => {
    this.rows = rows;

    this.grid.scrollbar.setScrollOffsetY(this.grid.offsetY);
    this.grid.scrollbar.setScrollOffsetX(this.grid.offsetX);
    this.grid.renderViewportRows();
    this.grid.scrollbar.refreshThumb();

    if (!skipSendToWorker) {
      // TODO: this is blocking wtf, gotta split this up
      const t0 = performance.now();
      viewWorker.postMessage({
        type: "set-rows",
        rows: this.rows,
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
  destroy = () => {
    // no memory leaks.. make sure gc kicks in asap
    // @ts-expect-error
    this.viewBuffer = null;
    // @ts-expect-error
    this.noViewBuffer = null;
    viewWorker.terminate();
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
