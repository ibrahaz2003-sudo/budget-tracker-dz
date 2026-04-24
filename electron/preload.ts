import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Generic invoke for channel-based IPC
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
