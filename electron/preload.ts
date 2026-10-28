import { contextBridge, ipcRenderer } from 'electron';

// Sandboxed preloads cannot import local modules, so the channel names live here and in main.ts.
contextBridge.exposeInMainWorld('cornerApi', {
  isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:is-always-on-top'),
  setAlwaysOnTop: (value: boolean): Promise<boolean> => ipcRenderer.invoke('window:set-always-on-top', value),
  setOpacity: (value: number): Promise<number> => ipcRenderer.invoke('window:set-opacity', value),
  minimize: (): void => ipcRenderer.send('window:minimize'),
  close: (): void => ipcRenderer.send('window:close'),
});
