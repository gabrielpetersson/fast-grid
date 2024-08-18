// TODO(gab): make this a setting
export const CELL_WIDTH = 150;

export interface Cell {
  id: number;
  text: string;
  val: number;
}

// class EnumCell {
//   pillContainer: HTMLDivElement;
//   cellComponent: CellComponent;
//   constructor(cellComponent: CellComponent) {
//     this.cellComponent = cellComponent;

//     this.pillContainer = document.createElement("div");
//     this.pillContainer.className =
//       "inline-block rounded-full h-[20px] border border-solid border-gray-500 bg-blue text-white box-border cursor-default p-[3px_6px] truncate min-w-0";

//     this.setValue(this.cellComponent.value.value);
//     this.cellComponent.el.appendChild(this.pillContainer);
//   }
//   setValue(value: string) {
//     this.pillContainer.innerText = value;
//   }
// }

// class StringCell {
//   cellComponent: CellComponent;
//   _value: string = "";
//   constructor(cellComponent: CellComponent) {
//     this.cellComponent = cellComponent;
//     this.setValue(this.cellComponent.value.value);
//     // console.count("cell created");
//   }
//   setValue(value: string) {
//     // NOTE(gab): comparing innerText with textContent.
//     // experiment showing that textContent is not only faster for changing the text content, but
//     // is also the only one that does not run calculations on setting the same value
//     // https://codesandbox.io/s/textcontent-vs-innertext-vs-innerhtml-fj3cs0

//     this.cellComponent.el.innerText = value;
//   }
// }

export class CellComponent {
  el: HTMLDivElement;
  _offset: number;
  cellRef: Cell;
  constructor(offset: number, cellRef: Cell, isHeader?: boolean) {
    this._offset = offset;
    this.cellRef = cellRef;

    this.el = document.createElement("div");
    // NOTE(gab): can fonts be optimized? testing to render a cursive text with subpixel antialiasing, vs
    // rendering monospace text with text smoothing
    // https://codesandbox.io/s/performance-test-disabling-text-antialiasing-om6f3q?file=/index.js
    // NOTE(gab): align-items center is expensive, using padding for now
    this.el.className =
      "flex h-full pt-[5px] border-[0] border-r border-b border-solid border-gray-700 text-gray-800 box-border cursor-default pl-[6px] absolute left-0 overflow-clip";
    this.el.style.width = `${CELL_WIDTH}px`;

    if (isHeader) {
      this.el.style.backgroundColor = "white";
      this.el.style.fontWeight = "500";
    }

    this.setOffset(this._offset, true);
    this.setValue(cellRef);
  }
  setValue(cellRef: Cell) {
    this.cellRef = cellRef;
    this.el.innerText = cellRef.text;
  }
  setOffset(offset: number, force: boolean = false) {
    if (force || offset !== this._offset) {
      this.el.style.transform = `translateX(${offset}px)`;
    }
    this._offset = offset;
  }
}
