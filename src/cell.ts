import { Grid } from "./grid";

export const CELL_WIDTH = 200;

export type CellComponent = {
  id: number;
  el: HTMLDivElement;
  _offset: number;

  setContent: (text: string | number) => void;
  setOffset: (offset: number, force?: boolean) => void;
  reuse: (
    id: number,
    offset: number,
    text: string | number,
    index: number
  ) => void;
};

export class StringCell implements CellComponent {
  id: number;
  el: HTMLDivElement;
  _offset: number;

  constructor(id: number, offset: number, text: string | number) {
    this.id = id;
    this._offset = offset;

    this.el = document.createElement("div");
    // NOTE(gab): fonts are super expensive, might be more simple fonts that are faster to render? testing to render a cursive text with subpixel antialiasing, vs
    // rendering monospace text with text smoothing
    // https://codesandbox.io/s/performance-test-disabling-text-antialiasing-om6f3q?file=/index.js
    // NOTE(gab): align-items actually has a super slight imapact on Layerize time, using padding for now
    this.el.className =
      "flex h-full pt-[7px] border-[0] border-r border-b border-solid border-gray-700 text-gray-800 box-border cursor-default pl-[6px] absolute left-0 font-mono text-[14px]";
    this.el.style.width = `${CELL_WIDTH}px`;

    this.setOffset(this._offset, true);
    this.setContent(text);
  }

  setContent(text: string | number) {
    this.el.innerText = String(text);
  }
  setOffset(offset: number, force: boolean = false) {
    if (force || offset !== this._offset) {
      this.el.style.transform = `translateX(${offset}px)`;
    }
    this._offset = offset;
  }
  reuse(id: number, offset: number, text: string | number) {
    this.id = id;
    this.setOffset(offset, true);
    this.setContent(text);
  }
}

export class HeaderCell implements CellComponent {
  id: number;
  el: HTMLDivElement;
  _offset: number;

  constructor(id: number, offset: number, text: string | number) {
    this.id = id;
    this._offset = offset;

    this.el = document.createElement("div");
    this.el.className =
      "flex h-full pt-[5px] border-[0] border-r border-b-2 border-solid border-gray-700 text-gray-800 box-border cursor-default pl-[6px] absolute left-0 overflow-clip";
    this.el.style.width = `${CELL_WIDTH}px`;

    // extra header styles
    this.el.style.backgroundColor = "white";
    this.el.style.fontWeight = "500";
    this.el.style.fontFamily = "monospace";
    this.el.style.fontSize = "15px";

    this.setOffset(this._offset, true);
    this.setContent(text);
  }

  setContent(text: string | number) {
    this.el.innerText = String(text);
  }
  setOffset(offset: number, force: boolean = false) {
    if (force || offset !== this._offset) {
      this.el.style.transform = `translateX(${offset}px)`;
    }
    this._offset = offset;
  }
  reuse(id: number, offset: number, text: string | number) {
    this.id = id;
    this.setOffset(offset, true);
    this.setContent(text);
  }
}

export class FilterCell implements CellComponent {
  grid: Grid;
  index: number;
  id: number;
  el: HTMLDivElement;
  input: HTMLInputElement;
  arrow: SVGSVGElement;
  _offset: number;

  constructor(
    id: number,
    offset: number,
    text: string | number,
    grid: Grid,
    index: number
  ) {
    this.grid = grid;
    this.index = index;
    this.id = id;
    this._offset = offset;

    this.el = document.createElement("div");
    this.el.className =
      "flex h-full pt-[5px] border-[0] border-r border-b border-solid border-gray-700 text-gray-800 box-border cursor-default pl-[6px] absolute left-0 overflow-clip";
    this.el.style.width = `${CELL_WIDTH}px`;

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.value = String(text);
    this.input.className =
      "w-full h-full border-none outline-none text-[13px] select-none";
    this.input.style.fontFamily = "monospace";
    this.input.placeholder = "filter...";
    this.input.addEventListener("input", this.onInputChange);
    this.el.appendChild(this.input);

    const arrowContainer = document.createElement("div");
    arrowContainer.className =
      "flex items-center justify-center w-[35px] h-[28px] cursor-pointer";
    arrowContainer.addEventListener("click", this.onArrowClick);

    this.arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.arrow.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    this.arrow.setAttribute("viewBox", "0 0 24 24");
    this.arrow.setAttribute(
      "class",
      "w-5 h-5 fill-current transition-transform duration-200 rotate-90"
    );

    const mainPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    mainPath.setAttribute(
      "d",
      "M12 3.75l-6.5 6.5L7 11.75l3.5-3.5V20h3V8.25l3.5 3.5 1.5-1.5z"
    );
    this.arrow.appendChild(mainPath);

    const arrowHead = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    arrowHead.setAttribute("d", "M12 5.5L7.5 10h9z");
    arrowHead.setAttribute("fill", "currentColor");
    arrowHead.setAttribute("opacity", "0.3");
    this.arrow.appendChild(arrowHead);

    arrowContainer.appendChild(this.arrow);
    this.el.appendChild(arrowContainer);

    this.syncToFilter();
    this.setOffset(this._offset, true);
  }
  private onInputChange = () => {
    if (this.input.value === "") {
      delete this.grid.rowManager.view.filter[this.index];
    } else {
      this.grid.rowManager.view.filter[this.index] = this.input.value;
    }
    this.grid.rowManager.runFilter();
  };
  private onArrowClick = () => {
    const idx = this.grid.rowManager.view.sort.findIndex(
      (sort) => sort.column === this.index
    );
    const currentSort = idx !== -1 ? this.grid.rowManager.view.sort[idx] : null;
    if (currentSort == null) {
      this.grid.rowManager.view.sort.push({
        direction: "descending",
        column: this.index,
      });
      this.arrow.style.transform = "rotate(180deg)";
    } else if (currentSort.direction === "descending") {
      currentSort.direction = "ascending";
      this.arrow.style.transform = "rotate(0deg)";
    } else {
      this.grid.rowManager.view.sort.splice(idx, 1);
      this.arrow.style.transform = "rotate(90deg)";
    }
    this.grid.rowManager.runSort();
  };
  syncToFilter = () => {
    if (this.index in this.grid.rowManager.view.filter) {
      this.input.value = this.grid.rowManager.view.filter[this.index];
    } else {
      this.input.value = "";
    }

    if (this.index in this.grid.rowManager.view.sort) {
      const sort = this.grid.rowManager.view.sort.find(
        (sort) => sort.column === this.index
      );
      if (sort == null) {
        this.arrow.style.transform = "rotate(90deg)";
      } else if (sort.direction === "descending") {
        this.arrow.style.transform = "rotate(180deg)";
      } else {
        this.arrow.style.transform = "rotate(0deg)";
      }
    }
  };
  setContent = () => {
    this.syncToFilter();
  };
  setOffset = (offset: number, force: boolean = false) => {
    if (force || offset !== this._offset) {
      this.el.style.transform = `translateX(${offset}px)`;
    }
    this._offset = offset;
  };
  reuse = (
    id: number,
    offset: number,
    _text: string | number,
    index: number
  ) => {
    this.id = id;
    this.index = index;
    this.setOffset(offset, true);
    this.syncToFilter();
  };
}
