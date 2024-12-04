export class TouchScrolling {
  el: HTMLDivElement;
  decelerationId: number | null;
  touchScrollState?: {
    lastOffsetY: number;
    lastDeltaY: number;
    lastOffsetX: number;
    lastDeltaX: number;
  };
  constructor(el: HTMLDivElement) {
    this.el = el;
    this.el.addEventListener("touchstart", this.onTouchStart);
    this.el.addEventListener("touchend", this.onTouchEnd);
    this.el.addEventListener("touchmove", this.onTouchMove);
    this.decelerationId = null;
  }
  dispatchWheelEvent(deltaY: number, deltaX: number) {
    const wheelEvent = new WheelEvent("wheel", {
      deltaY: deltaY,
      deltaX: deltaX,
      deltaMode: 0,
    });
    this.el.dispatchEvent(wheelEvent);
  }
  simulateDeceleratedScrolling(decelerationId: number) {
    if (this.touchScrollState == null) {
      return;
    }
    const decelerationFactor = 0.95;
    let currentDeltaY = this.touchScrollState.lastDeltaY;
    let currentDeltaX = this.touchScrollState.lastDeltaX;

    const step = () => {
      currentDeltaY *= decelerationFactor;
      currentDeltaX *= decelerationFactor;
      if (
        (Math.abs(currentDeltaY) < 0.1 && Math.abs(currentDeltaX) < 0.1) ||
        decelerationId !== this.decelerationId
      ) {
        return;
      }
      this.dispatchWheelEvent(currentDeltaY, currentDeltaX);
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
  onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      this.touchScrollState = {
        lastOffsetY: event.touches[0].clientY,
        lastDeltaY: 0,
        lastOffsetX: event.touches[0].clientX,
        lastDeltaX: 0,
      };
      this.decelerationId = Date.now();
    }
  };
  onTouchEnd = () => {
    if (this.touchScrollState != null && this.decelerationId != null) {
      this.simulateDeceleratedScrolling(this.decelerationId);
    }
    delete this.touchScrollState;
  };
  onTouchMove = (event: TouchEvent) => {
    if (this.touchScrollState == null || event.touches.length !== 1) {
      return;
    }
    event.preventDefault();

    const currentTouchY = event.touches[0].clientY;
    const currentTouchX = event.touches[0].clientX;
    const deltaY = this.touchScrollState.lastOffsetY - currentTouchY;
    const deltaX = this.touchScrollState.lastOffsetX - currentTouchX;
    this.dispatchWheelEvent(deltaY, deltaX);

    if (this.touchScrollState != null) {
      this.touchScrollState.lastOffsetY = currentTouchY;
      this.touchScrollState.lastDeltaY = deltaY;
      this.touchScrollState.lastOffsetX = currentTouchX;
      this.touchScrollState.lastDeltaX = deltaX;
      return;
    }
    this.touchScrollState = {
      lastOffsetY: currentTouchY,
      lastDeltaY: deltaY,
      lastOffsetX: currentTouchX,
      lastDeltaX: deltaX,
    };
  };
}
