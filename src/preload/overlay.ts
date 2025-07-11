import { contextBridge, ipcRenderer } from 'electron'

// Overlay API for renderer
const overlayApi = {
  // Receive data from main process
  onData: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('overlay:data', handler)
    return () => ipcRenderer.removeListener('overlay:data', handler)
  },

  // Receive theme updates
  onThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme)
    ipcRenderer.on('overlay:theme-update', handler)
    return () => ipcRenderer.removeListener('overlay:theme-update', handler)
  },

  // Send skin selection
  selectSkin: (skin: any) => {
    ipcRenderer.send('overlay:skin-selected', skin)
  },

  // Close overlay
  close: () => {
    ipcRenderer.send('overlay:close')
  },

  // Notify ready state
  ready: () => {
    ipcRenderer.send('overlay:ready')
  }
}

// Expose in the renderer world
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('overlayApi', overlayApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.overlayApi = overlayApi
}
