import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

interface AutoSelectedSkinProps {
  skin: {
    skinId: string
    skinName: string
    skinNum: number
    splashPath?: string
    rarity?: string
  }
  championName: string
  onClose: () => void
}

export function AutoSelectedSkin({ skin, championName, onClose }: AutoSelectedSkinProps) {
  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const getRarityColor = (rarity?: string) => {
    switch (rarity?.toLowerCase()) {
      case 'epic':
        return 'from-purple-600 to-purple-400'
      case 'legendary':
        return 'from-orange-600 to-orange-400'
      case 'ultimate':
        return 'from-red-600 to-red-400'
      case 'mythic':
        return 'from-pink-600 to-pink-400'
      default:
        return 'from-blue-600 to-blue-400'
    }
  }

  const getRarityGemUrl = (rarity?: string) => {
    if (!rarity) return null
    // Remove 'k' prefix if present and convert to lowercase
    const cleanRarity = rarity.replace(/^k/i, '').toLowerCase()
    if (cleanRarity === 'norarity' || cleanRarity === 'default') return null
    return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/rarity-gem-icons/${cleanRarity}.png`
  }

  return (
    <div className="fixed top-4 right-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: 50 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 50 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="relative w-[420px] h-[240px] pointer-events-none"
      >
        {/* Main card */}
        <div
          className="relative overflow-hidden rounded-xl shadow-2xl h-full"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}
        >
          {/* Splash art background - full size */}
          {skin.splashPath ? (
            <motion.div
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <img
                src={skin.splashPath}
                alt={skin.skinName}
                className="w-full h-full object-cover"
              />
              {/* Dark gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            </motion.div>
          ) : (
            /* Fallback gradient when no image */
            <div
              className={cn('absolute inset-0 bg-gradient-to-br', getRarityColor(skin.rarity))}
            />
          )}

          {/* Content overlay */}
          <div className="relative h-full flex flex-col justify-between p-4">
            {/* Top section - Auto-selected badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-yellow-400 font-medium text-xs uppercase tracking-wide">
                  Auto-Selected
                </span>
              </div>
            </motion.div>

            {/* Bottom section - Skin info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-1"
            >
              {/* Skin name with rarity gem */}
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white drop-shadow-lg">{skin.skinName}</h2>
                {skin.rarity && getRarityGemUrl(skin.rarity) && (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    src={getRarityGemUrl(skin.rarity)!}
                    alt={skin.rarity}
                    className="h-5 w-5 drop-shadow-lg"
                  />
                )}
              </div>

              {/* Champion name */}
              <p className="text-sm text-white/80 drop-shadow">{championName}</p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
