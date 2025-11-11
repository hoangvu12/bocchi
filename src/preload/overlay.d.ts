import type {
  OverlayChampionData,
  OverlayTheme,
  OverlaySkinSelection
} from '../main/types/overlay.types'

export interface IOverlayApi {
  onData: (callback: (data: OverlayChampionData) => void) => () => void
  onThemeUpdate: (callback: (theme: OverlayTheme) => void) => () => void
  selectSkin: (skin: OverlaySkinSelection) => void
  close: () => void
  ready: () => void
}

declare global {
  interface Window {
    overlayApi: IOverlayApi
  }
}
