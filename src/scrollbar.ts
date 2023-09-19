import { Grid } from "./grid";

export class Scrollbar {
  trackY: HTMLDivElement;
  thumbY: HTMLDivElement;
  trackX: HTMLDivElement;
  thumbX: HTMLDivElement;

  isScrolling: boolean;
  transientScrollOffsetY: number;
  transientScrollOffsetX: number;

  grid: Grid;
  constructor(grid: Grid) {
    this.grid = grid;
    this.isScrolling = false;
    this.transientScrollOffsetY = 0;
    this.transientScrollOffsetX = 0;

    this.trackX = document.createElement("div");
    this.trackX.className =
      "absolute bottom-0 z-10 h-[8px] w-full cursor-pointer bg-gray-100 border-t border-gray-300";

    this.thumbX = document.createElement("div");
    this.thumbX.className =
      "h-full cursor-pointer bg-gray-400 hover:opacity-90 rounded";

    this.trackY = document.createElement("div");
    this.trackY.className =
      "absolute right-0 z-10 h-full w-[8px] cursor-pointer bg-gray-100 border-l border-gray-300";

    this.thumbY = document.createElement("div");
    this.thumbY.className =
      "w-full cursor-pointer bg-gray-400 hover:opacity-90 rounded";

    this.trackX.addEventListener("mousemove", this.onTrackMouseMoveX);
    this.trackX.addEventListener("mousedown", this.onTrackMouseDownX);

    this.trackY.addEventListener("mousemove", this.onTrackMouseMoveY);
    this.trackY.addEventListener("mousedown", this.onTrackMouseDownY);

    this.thumbX.addEventListener("mousedown", this.onThumbMouseDownX);
    this.thumbY.addEventListener("mousedown", this.onThumbMouseDownY);

    this.grid.container.addEventListener("wheel", this.onContainerWheel);

    this.trackX.appendChild(this.thumbX);
    this.trackY.appendChild(this.thumbY);
    this.grid.container.appendChild(this.trackX);
    this.grid.container.appendChild(this.trackY);

    this.refreshThumb();
  }
  refreshThumb = () => {
    const state = this.grid.getState();
    this.translateThumbY(state.thumbOffsetY);
    this.setThumbSizeY(state.thumbSizeY);
    this.translateThumbX(state.thumbOffsetX);
    this.setThumbSizeX(state.thumbSizeX);
  };
  clampThumbIfNeeded = ({ x, y }: { x?: number; y?: number }) => {
    const state = this.grid.getState();
    let shouldTranslateThumb = false;
    if (y != null && (y < 0 || y > state.scrollableHeight)) {
      const clampedOffsetY = Math.max(0, Math.min(y, state.scrollableHeight));
      this.grid.offsetY = clampedOffsetY;
      shouldTranslateThumb = true;
    }
    if (x != null && (x < 0 || x > state.scrollableWidth)) {
      const clampedOffsetX = Math.max(0, Math.min(x, state.scrollableWidth));
      this.grid.offsetX = clampedOffsetX;
      shouldTranslateThumb = true;
    }

    if (shouldTranslateThumb) {
      const state2 = this.grid.getState();
      if (x != null) {
        this.translateThumbX(state2.thumbOffsetX);
      }
      if (y != null) {
        this.translateThumbY(state2.thumbOffsetY);
      }
    }
  };
  setScrollOffset = ({ x, y }: { x?: number; y?: number }) => {
    const state = this.grid.getState();
    if (x != null) {
      const clampedOffsetX = Math.max(0, Math.min(x, state.scrollableWidth));
      this.grid.offsetX = clampedOffsetX;
    }
    if (y != null) {
      const clampedOffsetY = Math.max(0, Math.min(y, state.scrollableHeight));
      this.grid.offsetY = clampedOffsetY;
    }
    const state2 = this.grid.getState();
    if (x != null) {
      this.translateThumbX(state2.thumbOffsetX);
    }
    if (y != null) {
      this.translateThumbY(state2.thumbOffsetY);
    }
  };
  scrollBy = ({ x, y }: { x?: number; y?: number }) => {
    this.setScrollOffset({
      x: x != null ? this.grid.offsetX + x : undefined,
      y: y != null ? this.grid.offsetY + y : undefined,
    });
    if (y != null) {
      this.grid.renderViewportRows();
    }
    if (x != null) {
      this.grid.renderViewportCells();
    }
  };
  onContainerWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let deltaY = e.deltaY;
    let deltaX = e.deltaX;
    // NOTE(gab): it's hard to scroll exactly horizontally or vertically, so zero out
    // the other dimension for small deltas if scrolling fast
    if (Math.abs(deltaY) > 30 && Math.abs(deltaX) < 15) {
      deltaX = 0;
    } else if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 15) {
      deltaY = 0;
    }

    this.transientScrollOffsetX += deltaX;
    this.transientScrollOffsetY += deltaY;
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;
    // NOTE(gab): makes sure scroll events are only triggered at most
    // once every frame. useses transient scrolling to keep track of
    // intermediate scroll offsets
    window.requestAnimationFrame(() => {
      this.scrollBy({
        x:
          this.transientScrollOffsetX != 0
            ? this.transientScrollOffsetX
            : undefined,
        y:
          this.transientScrollOffsetY != 0
            ? this.transientScrollOffsetY
            : undefined,
      });
      this.isScrolling = false;
      this.transientScrollOffsetX = 0;
      this.transientScrollOffsetY = 0;
    });
  };
  onThumbMouseDownY = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.setProperty("cursor", "grabbing", "important");
    document.addEventListener("mousemove", this.onThumbDragY);
    document.addEventListener("mouseup", this.onThumbMouseUpY);
  };
  onThumbDragY = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const state = this.grid.getState();

    this.transientScrollOffsetY +=
      // TODO(gab): figure out the 1.5 lol. works perfectly somehow
      (e.movementY / this.grid.viewportHeight) * state.tableHeight;
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;
    window.requestAnimationFrame(() => {
      this.scrollBy({ y: this.transientScrollOffsetY });
      this.isScrolling = false;
      this.transientScrollOffsetY = 0;
    });
  };
  onThumbMouseUpY = () => {
    document.body.style.removeProperty("cursor");
    document.removeEventListener("mousemove", this.onThumbDragY);
    document.removeEventListener("mouseup", this.onThumbMouseUpY);
    this.isScrolling = false;
    if (this.transientScrollOffsetY > 0) {
      this.scrollBy({ y: this.transientScrollOffsetY });
    }
    this.transientScrollOffsetY = 0;
  };
  onThumbMouseDownX = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.setProperty("cursor", "grabbing", "important");
    document.addEventListener("mousemove", this.onThumbDragX);
    document.addEventListener("mouseup", this.onThumbMouseUpX);
  };
  onThumbDragX = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const state = this.grid.getState();
    this.transientScrollOffsetX +=
      // TODO(gab): figure out the 1.5 lol. works perfectly somehow
      (e.movementX / this.grid.viewportWidth) * state.tableWidth;
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;
    window.requestAnimationFrame(() => {
      this.scrollBy({ x: this.transientScrollOffsetX });
      this.isScrolling = false;
      this.transientScrollOffsetX = 0;
    });
  };
  onThumbMouseUpX = () => {
    document.body.style.removeProperty("cursor");
    document.removeEventListener("mousemove", this.onThumbDragX);
    document.removeEventListener("mouseup", this.onThumbMouseUpX);
    this.isScrolling = false;
    // NOTE(gab): makes sure the last cancelled scroll events are applied, if any
    if (this.transientScrollOffsetX > 0) {
      this.scrollBy({ x: this.transientScrollOffsetX });
    }
    this.transientScrollOffsetX = 0;
  };
  onTrackMouseMoveY = (e: MouseEvent) => {
    e.preventDefault();
  };
  onTrackMouseMoveX = (e: MouseEvent) => {
    e.preventDefault();
  };
  onTrackMouseDownY = (e: MouseEvent) => {
    e.preventDefault();
    const state = this.grid.getState();
    const relativeOffset =
      (e.offsetY / this.grid.viewportHeight) * state.tableHeight;
    this.setScrollOffset({ y: relativeOffset });
    this.grid.renderViewportRows();
  };
  onTrackMouseDownX = (e: MouseEvent) => {
    e.preventDefault();
    const state = this.grid.getState();
    const relativeOffset =
      (e.offsetX / this.grid.viewportWidth) * state.tableWidth;
    this.setScrollOffset({ x: relativeOffset });
    this.grid.renderViewportCells();
  };
  translateThumbY = (offset: number) => {
    this.thumbY.style.transform = `translateY(${offset}px)`;
  };
  translateThumbX = (offset: number) => {
    this.thumbX.style.transform = `translateX(${offset}px)`;
  };
  setThumbSizeY = (height: number) => {
    this.thumbY.style.height = `${height}px`;
  };
  setThumbSizeX = (width: number) => {
    this.thumbX.style.width = `${width}px`;
  };
}
