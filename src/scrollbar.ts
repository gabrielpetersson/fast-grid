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

    this.updateUi();
  }
  updateUi = () => {
    const metrics = this.grid.getMetrics();
    this.setOffsetY(metrics.scrollYOffset);
    this.setThumbSizeY(metrics.scrollThumbYSize);
    this.setOffsetX(metrics.scrollXOffset);
    this.setThumbSizeX(metrics.scrollThumbXSize);
  };
  setScrollOffsetY = (offset: number) => {
    const metrics = this.grid.getMetrics();
    const newOffset2 = Math.max(0, Math.min(offset, metrics.missingHeight));
    this.grid.scrollOffsetY = newOffset2;
    const metrics2 = this.grid.getMetrics();
    this.setOffsetY(metrics2.scrollYOffset);
    this.grid.renderViewportRows();
  };
  setScrollOffsetX = (offset: number) => {
    const metrics = this.grid.getMetrics();
    const newOffset2 = Math.max(0, Math.min(offset, metrics.missingWidth));
    this.grid.scrollOffsetX = newOffset2;
    const metrics2 = this.grid.getMetrics();
    this.setOffsetX(metrics2.scrollXOffset);
    this.grid.renderViewportCells();
  };
  scrollByY = (offset: number) => {
    const newOffset = this.grid.scrollOffsetY + offset;
    this.setScrollOffsetY(newOffset);
  };
  scrollByX = (offset: number) => {
    const newOffset = this.grid.scrollOffsetX + offset;
    this.setScrollOffsetX(newOffset);
  };
  onContainerWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // NOTE(gab): with this logic, fake events can be dispatched that scrolls the grid for performance testing
    const deltaY = e.deltaY != null ? e.deltaY : (e.detail as any).deltaY ?? 0;
    const deltaX = e.deltaX != null ? e.deltaX : (e.detail as any).deltaX ?? 0;

    // NOTE(gab): scroll only the direction that scrolls the most
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      this.transientScrollOffsetX += deltaX;
      if (this.isScrolling) {
        return;
      }

      this.isScrolling = true;
      window.requestAnimationFrame(() => {
        this.scrollByX(this.transientScrollOffsetX);
        this.isScrolling = false;
        this.transientScrollOffsetX = 0;
      });
    } else {
      this.transientScrollOffsetY += deltaY;
      if (this.isScrolling) {
        return;
      }

      this.isScrolling = true;
      window.requestAnimationFrame(() => {
        this.scrollByY(this.transientScrollOffsetY);
        this.isScrolling = false;
        this.transientScrollOffsetY = 0;
      });
    }
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
    const metrics = this.grid.getMetrics();
    // NOTE(gab): when dragging the scrollbar, we need to calculate the offset relative to the viewport height,
    // in constrast to the wheel event where the absolute offset is used
    const relativeOffset =
      (e.movementY / metrics.viewportHeight) * metrics.requiredHeight;
    this.transientScrollOffsetY += relativeOffset;
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;
    window.requestAnimationFrame(() => {
      this.scrollByY(this.transientScrollOffsetY);
      this.isScrolling = false;
      this.transientScrollOffsetY = 0;
    });
  };
  onThumbMouseUpY = () => {
    document.body.style.removeProperty("cursor");
    document.removeEventListener("mousemove", this.onThumbDragY);
    document.removeEventListener("mouseup", this.onThumbMouseUpY);
    this.isScrolling = false;
    // NOTE(gab): makes sure the last scroll events are applied if any
    if (this.transientScrollOffsetY !== 0) {
      this.scrollByY(this.transientScrollOffsetY);
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
    e.stopPropagation();
    const metrics = this.grid.getMetrics();
    const relativeOffset =
      (e.movementX / metrics.viewportWidth) * metrics.requiredWidth;
    this.transientScrollOffsetX += relativeOffset;
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;
    window.requestAnimationFrame(() => {
      this.scrollByY(this.transientScrollOffsetX);
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
    if (this.transientScrollOffsetX !== 0) {
      this.scrollByY(this.transientScrollOffsetX);
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
    const metrics = this.grid.getMetrics();
    const relativeOffset =
      (e.offsetY / metrics.viewportHeight) * metrics.requiredHeight;
    this.setScrollOffsetY(relativeOffset);
  };
  onTrackMouseDownX = (e: MouseEvent) => {
    e.preventDefault();
    const metrics = this.grid.getMetrics();
    const relativeOffset =
      (e.offsetX / metrics.viewportWidth) * metrics.requiredWidth;
    this.setScrollOffsetX(relativeOffset);
  };
  setOffsetY = (offset: number) => {
    this.thumbY.style.transform = `translateY(${offset}px)`;
  };
  setOffsetX = (offset: number) => {
    this.thumbX.style.transform = `translateX(${offset}px)`;
  };
  setThumbSizeY = (height: number) => {
    this.thumbY.style.height = `${height}px`;
  };
  setThumbSizeX = (width: number) => {
    this.thumbX.style.width = `${width}px`;
  };
}
