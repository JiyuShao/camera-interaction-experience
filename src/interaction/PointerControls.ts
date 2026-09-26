export interface PointerControlCallbacks {
  onRotate(deltaX: number, deltaY: number): void;
  onZoom(delta: number): void;
  onInteract(): void;
  onTap(): void;
}

export class PointerControls {
  private readonly pointers = new Map<number, PointerEvent>();
  private readonly pointerStarts = new Map<number, { x: number; y: number }>();
  private readonly movedPointers = new Set<number>();
  private previousPinchDistance: number | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: PointerControlCallbacks,
  ) {
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, event);
    this.pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size > 1) {
      this.pointers.forEach((_, pointerId) => this.movedPointers.add(pointerId));
    }
    this.callbacks.onInteract();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    this.pointers.set(event.pointerId, event);
    const start = this.pointerStarts.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      this.movedPointers.add(event.pointerId);
    }

    if (this.pointers.size === 1) {
      this.callbacks.onRotate(event.clientX - previous.clientX, event.clientY - previous.clientY);
      return;
    }

    const [first, second] = [...this.pointers.values()];
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    if (this.previousPinchDistance !== null) {
      this.callbacks.onZoom((distance - this.previousPinchDistance) * 0.006);
    }
    this.previousPinchDistance = distance;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasTap = this.pointers.size === 1 && !this.movedPointers.has(event.pointerId);
    this.pointers.delete(event.pointerId);
    this.pointerStarts.delete(event.pointerId);
    this.movedPointers.delete(event.pointerId);
    this.previousPinchDistance = null;
    if (wasTap) this.callbacks.onTap();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.callbacks.onInteract();
    this.callbacks.onZoom(-event.deltaY * 0.0008);
  };
}
