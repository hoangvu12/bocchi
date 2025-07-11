export interface IOverlayApi {
  onData: (callback: (data: any) => void) => () => void
  onThemeUpdate: (callback: (theme: any) => void) => () => void
  selectSkin: (skin: any) => void
  close: () => void
  ready: () => void
}

declare global {
  interface Window {
    overlayApi: IOverlayApi
  }
}
