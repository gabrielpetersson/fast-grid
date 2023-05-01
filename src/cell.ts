import { RowComponent } from "./row";

// TODO(gab): make this a setting
export const CELL_WIDTH = 130;

export interface Cell {
  type: "string" | "enum";
  value: string;
  s: number;
  key: string;
}

class EnumCell {
  pillContainer: HTMLDivElement;
  cellComponent: CellComponent;
  constructor(cellComponent: CellComponent) {
    this.cellComponent = cellComponent;

    this.pillContainer = document.createElement("div");
    this.pillContainer.className =
      "inline-block rounded-full h-[20px] border border-solid border-gray-500 bg-blue text-white box-border cursor-default p-[3px_6px] truncate min-w-0";

    this.setValue(this.cellComponent.value.value);
    this.cellComponent.el.appendChild(this.pillContainer);
  }
  setValue(value: string) {
    this.pillContainer.innerText = value;
  }
}

class StringCell {
  cellComponent: CellComponent;
  constructor(cellComponent: CellComponent) {
    this.cellComponent = cellComponent;
    this.setValue(this.cellComponent.value.value);
  }
  setValue(value: string) {
    // NOTE(gab): comparing innerText with textContent. why is nodeValue not setting anything??? react uses that
    // experiment showing that textContent is not only faster for changing the text content, but
    // is also the only one that does not run calculations on setting the same value
    // https://codesandbox.io/s/textcontent-vs-innertext-vs-innerhtml-fj3cs0
    this.cellComponent.el.innerText = value;
  }
}

export class CellComponent {
  el: HTMLDivElement;
  content: EnumCell | StringCell;
  rowComponent: RowComponent;
  value: Cell;
  constructor(rowComponent: RowComponent, value: Cell) {
    this.rowComponent = rowComponent;
    this.value = value;

    this.el = document.createElement("div");
    // NOTE(gab): can fonts be optimized? testing to render a cursive text with subpixel antialiasing, vs
    // rendering monospace text with text smoothing
    // https://codesandbox.io/s/performance-test-disabling-text-antialiasing-om6f3q?file=/index.js
    // NOTE(gab): align-items center is expensive, using padding for now
    this.el.className =
      "flex h-full pt-[5px] border-[0] border-r border-b border-solid border-gray-700 text-gray-800 box-border cursor-default pl-[6px] absolute left-0 overflow-clip";
    this.el.style.width = `${CELL_WIDTH}px`;

    this.content = new StringCell(this);
  }
  setValue(value: Cell) {
    // TODO(gab): what is this weird state management
    this.value = value;
    this.content.setValue(value.value);
  }
  setOffset(offset: number) {
    this.el.style.transform = `translateX(${offset}px)`;
  }
  destroy() {
    // NOTE(gab): can speed be improved?
    // https://github.com/brianmhunt/knockout-fast-foreach/issues/37
    // TODO(gab): should not need this, but crashes on my other computer otherwise. check
    if (this.rowComponent.el.contains(this.el)) {
      this.rowComponent.el.removeChild(this.el);
    } else {
      console.error("cell component already removed");
    }
  }
}
