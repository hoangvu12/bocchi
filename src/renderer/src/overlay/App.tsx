import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AutoSelectedSkin } from './components/AutoSelectedSkin'
import { useOverlayData } from './hooks/useOverlayData'
import { applyTheme } from '../themes/utils'
import { defaultDarkTheme } from '../themes/themes'

export default function App() {
  const { overlayData, theme } = useOverlayData()
  const [isVisible, setIsVisible] = useState(false)

  // Apply theme when it changes or use default dark theme
  useEffect(() => {
    const themeToApply = theme || defaultDarkTheme
    applyTheme(themeToApply)
  }, [theme])

  // Show overlay when data is received (only for auto-random)
  useEffect(() => {
    if (overlayData && overlayData.autoRandomEnabled && overlayData.autoSelectedSkin) {
      setIsVisible(true)
    }
  }, [overlayData])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      window.overlayApi.close()
    }, 300) // Wait for animation to complete
  }

  if (!overlayData || !overlayData.autoRandomEnabled || !overlayData.autoSelectedSkin) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full relative"
        >
          <AutoSelectedSkin
            skin={overlayData.autoSelectedSkin}
            championName={overlayData.championName}
            onClose={handleClose}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
