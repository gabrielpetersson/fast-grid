import { CELL_WIDTH, HeaderCell, FilterCell, StringCell } from "./cell";
import { Row, RowComponent } from "./row";
import { RowManager, Rows } from "./row-manager/row-manager";
import { Scrollbar } from "./scrollbar";
import { TouchScrolling as PhoneControls } from "./utils/touch-scroll";

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

const HEADER_ID = 99999999999999; // very dumb

export class Grid {
  state: GridState;

  headerRows: RowComponent[];

  offsetY: number;
  offsetX: number;

  windowHeight: number;
  windowWidth: number;

  container: HTMLDivElement;
  rowComponentMap: Record<number, RowComponent>;

  scrollbar: Scrollbar;
  rowManager: RowManager;

  viewportWidth: number;
  viewportHeight: number;
  numCols: number;

  resizeObserver: ResizeObserver;
  constructor(container: HTMLDivElement, rows: Rows, headers: string[]) {
    this.container = container;
    this.rowManager = new RowManager(this, rows);

    this.headerRows = this.createHeader(headers);
    this.numCols = headers.length; // set once atm so might cause bugs

    this.viewportWidth = this.container.clientWidth;
    this.viewportHeight =
      this.container.clientHeight - ROW_HEIGHT * this.headerRows.length;

    this.state = this.getState();

    this.offsetY = 0;
    this.offsetX = 0;

    this.rowComponentMap = {};
    this.windowHeight = window.innerHeight;
    this.windowWidth = window.innerWidth;

    this.scrollbar = new Scrollbar(this);
    new PhoneControls(this.container);

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container);

    this.renderViewportRows();
    for (const row of this.headerRows) {
      row.renderCells();
    }

    if (typeof SharedArrayBuffer === "undefined") {
      window.alert(
        "SharedArrayBuffer is not available. Grid might not work properly."
      );
    }
  }
  createHeader(headers: string[]) {
    let offset = 0;
    const toolsRow = new RowComponent(
      this,
      HEADER_ID,
      headers.map((_, i) => ({
        id: i,
        v: "",
      })),
      offset,
      FilterCell
    );
    const headerRow = new RowComponent(
      this,
      HEADER_ID,
      headers.map((header, i) => ({
        id: i,
        v: header,
      })),
      (offset += ROW_HEIGHT),
      HeaderCell
    );

    this.container.appendChild(toolsRow.el);
    this.container.appendChild(headerRow.el);
    return [toolsRow, headerRow];
  }
  getState = (): GridState => {
    const numRows = this.rowManager.getNumRows();

    const cellsPerRow = Math.ceil(this.viewportWidth / CELL_WIDTH) + 1;
    const tableWidth = this.numCols * CELL_WIDTH;

    // full viewport, and an additional row top and bottom to simulate scrolling
    const rowsPerViewport = Math.ceil(this.viewportHeight / ROW_HEIGHT);

    const tableHeight = numRows * ROW_HEIGHT;

    const startCell = Math.floor(this.offsetX / CELL_WIDTH);
    const endCell = Math.min(startCell + cellsPerRow, this.numCols);
    const cellOffset = -Math.floor(this.offsetX % CELL_WIDTH);

    // start to end of rows to render, along with the row offset to simulate scrolling
    const startRow = Math.floor(this.offsetY / ROW_HEIGHT);
    const endRow = Math.min(startRow + rowsPerViewport, numRows);
    const rowOffset = -Math.floor(this.offsetY % ROW_HEIGHT);

    const scrollableHeight = Math.max(tableHeight - this.viewportHeight, 0);

    const scrollThumbYPct =
      tableHeight === 0
        ? 1
        : // makes thumb smaller slower, so that smaller changes in rows still slighly changes size
          0.97 * Math.sqrt(this.viewportHeight / tableHeight) + 0.03;

    const thumbSizeY = Math.round(
      Math.max(
        Math.min(scrollThumbYPct * this.viewportHeight, this.viewportHeight),
        0
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

    // dumb but anyway it minimizes GC by not allocating a shit ton of pointers since these are all scalars.
    // might be a bit slower but we are already way below 16ms per frame
    if (this.state != null) {
      this.state.endRow = endRow;
      this.state.startRow = startRow;
      this.state.rowOffset = rowOffset + ROW_HEIGHT * this.headerRows.length;

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

  renderViewportRows = () => {
    // reusing DOM and updating only the least possible content. 3 steps:
    // 1) see which rows goes out of viewport
    // 2) see which rows comes into viewport. reuse rows if possible, otherwise create new DOM elements
    // 3) remove rows from the DOM

    const state = this.getState();
    const viewBuffer = this.rowManager.getViewBuffer();

    const renderRows: Record<string, true> = {};
    const rowsArr = this.rowManager.rows;

    for (let i = state.startRow; i < state.endRow; i++) {
      let row: Row;
      if (viewBuffer == null) {
        renderRows[i] = true;
      } else {
        row = rowsArr[Atomics.load(viewBuffer.buffer, i)];
        if (row == null) {
          continue;
        }
        renderRows[row.id] = true;
      }
    }

    const removeRows: RowComponent[] = [];
    for (const id in this.rowComponentMap) {
      if (id in renderRows) {
        continue;
      }
      const rowComponent = this.rowComponentMap[id]!;
      removeRows.push(rowComponent);
    }

    for (let i = state.startRow; i < state.endRow; i++) {
      let row: Row;
      if (viewBuffer == null) {
        row = rowsArr[i];
      } else {
        row = rowsArr[Atomics.load(viewBuffer.buffer, i)];
      }

      if (row == null) {
        console.error("cannot find row", i);
        continue;
      }

      const offset = state.rowOffset + (i - state.startRow) * ROW_HEIGHT;
      const existingRow = this.rowComponentMap[row.id];
      if (existingRow != null) {
        existingRow.setOffset(offset);
        continue;
      }

      const reuseRow = removeRows.pop();
      if (reuseRow != null) {
        delete this.rowComponentMap[reuseRow.id];
        reuseRow.id = row.id;
        reuseRow.cells = row.cells;
        reuseRow.setOffset(offset);
        reuseRow.renderCells();
        this.rowComponentMap[row.id] = reuseRow;
        continue;
      }

      const rowComponent = new RowComponent(
        this,
        row.id,
        row.cells,
        offset,
        StringCell
      );
      this.container.appendChild(rowComponent.el);
      this.rowComponentMap[row.id] = rowComponent;
    }

    for (const row of removeRows) {
      row.destroy();
      delete this.rowComponentMap[row.id];
    }
  };
  // TODO(gab): should only be done on X scroll, row reusing and creating a new row
  renderViewportCells = () => {
    const state = this.getState();
    const viewBuffer = this.rowManager.getViewBuffer();

    for (let i = state.startRow; i < state.endRow; i++) {
      let rowComponent: RowComponent | null = null;
      if (viewBuffer != null) {
        rowComponent = this.rowComponentMap[Atomics.load(viewBuffer.buffer, i)];
      } else {
        rowComponent = this.rowComponentMap[i];
      }
      if (rowComponent == null) {
        console.error("row should exist. did you render rows first?");
        continue;
      }
      rowComponent.renderCells();
    }

    for (const row of this.headerRows) {
      row.renderCells();
    }
  };
  onResize = () => {
    this.viewportWidth = this.container.clientWidth;
    this.viewportHeight = this.container.clientHeight;
    this.scrollbar.setScrollOffsetY(this.offsetY);
    this.scrollbar.setScrollOffsetX(this.offsetX);
    this.renderViewportRows();
    this.renderViewportCells();
    this.scrollbar.refreshThumb();
  };
  destroy = () => {
    for (const id in this.rowComponentMap) {
      this.rowComponentMap[id].destroy();
    }
    for (const row of this.headerRows) {
      row.destroy();
    }
    this.resizeObserver.disconnect();
  };
}
