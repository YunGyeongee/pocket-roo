/** Exposed by electron/preload.ts. Undefined when the page runs in a plain browser. */
interface CornerApi {
  isAlwaysOnTop(): Promise<boolean>;
  setAlwaysOnTop(value: boolean): Promise<boolean>;
  minimize(): void;
  close(): void;
}

interface Window {
  cornerApi?: CornerApi;
}
