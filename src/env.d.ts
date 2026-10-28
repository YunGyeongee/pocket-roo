/** Exposed by electron/preload.ts. Undefined when the page runs in a plain browser. */
interface CornerApi {
  isAlwaysOnTop(): Promise<boolean>;
  setAlwaysOnTop(value: boolean): Promise<boolean>;
  /** Sets the window opacity (0.2..1) and returns what was applied. */
  setOpacity(value: number): Promise<number>;
  minimize(): void;
  close(): void;
}

interface Window {
  cornerApi?: CornerApi;
}
