export interface GameLoopOptions {
  update: (dt: number) => void;
  render: () => void;
  /** Frames above this rate are skipped to save CPU (e.g. on 120 Hz displays). */
  maxFps?: number;
}

/** requestAnimationFrame loop with a frame-rate cap. rAF already stops when the window is hidden. */
export class GameLoop {
  private frameId: number | null = null;
  private lastTime = 0;
  private readonly minFrameMs: number;

  constructor(private readonly options: GameLoopOptions) {
    // A little slack so a 60 Hz display doesn't drop every other frame.
    this.minFrameMs = 1000 / (options.maxFps ?? 60) - 1;
  }

  get running(): boolean {
    return this.frameId !== null;
  }

  start(): void {
    if (this.running) return;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private readonly tick = (now: number): void => {
    this.frameId = requestAnimationFrame(this.tick);
    const elapsed = now - this.lastTime;
    if (elapsed < this.minFrameMs) return;
    this.lastTime = now;
    this.options.update(elapsed / 1000);
    // update() may have stopped the loop; still draw this last frame.
    this.options.render();
  };
}
