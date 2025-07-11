import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'

interface Skin {
  id: string
  name: string
  num: number
  rarity?: string
  isDownloaded?: boolean
  isFavorite?: boolean
  splashPath?: string
  tilePath?: string
}

interface SkinSelectorProps {
  championId: number
  championKey: string
  championName: string
  skins: Skin[]
  onSelect: (skin: any) => void
  onClose: () => void
}

export function SkinSelector({
  championKey,
  championName,
  skins,
  onSelect,
  onClose
}: SkinSelectorProps) {
  const [selectedSkin, setSelectedSkin] = useState<Skin | null>(null)
  const [hoveredSkin, setHoveredSkin] = useState<Skin | null>(null)

  // Filter out default skin (num 0)
  const selectableSkins = useMemo(() => {
    return skins.filter((skin) => skin.num > 0)
  }, [skins])

  const handleSelect = () => {
    if (selectedSkin) {
      onSelect({
        championKey,
        championName,
        skinId: selectedSkin.id,
        skinName: selectedSkin.name,
        skinNum: selectedSkin.num
      })
    }
  }

  const getRarityColor = (rarity?: string) => {
    switch (rarity?.toLowerCase()) {
      case 'epic':
        return 'text-purple-400 border-purple-400'
      case 'legendary':
        return 'text-orange-400 border-orange-400'
      case 'ultimate':
        return 'text-red-400 border-red-400'
      case 'mythic':
        return 'text-pink-400 border-pink-400'
      default:
        return 'text-blue-400 border-blue-400'
    }
  }

  return (
    <div className="fixed top-4 right-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface backdrop-blur-xl rounded-xl shadow-2xl border border-border w-[450px] h-[500px] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{championName}</h2>
            <p className="text-foreground/60 text-xs">Select a skin to apply</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-background/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Skin Grid */}
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {selectableSkins.map((skin) => (
              <motion.div
                key={skin.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedSkin(skin)}
                onMouseEnter={() => setHoveredSkin(skin)}
                onMouseLeave={() => setHoveredSkin(null)}
                className={cn(
                  'relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all',
                  selectedSkin?.id === skin.id
                    ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                    : 'border-transparent hover:border-border'
                )}
              >
                <div className="aspect-[3/4] relative">
                  {skin.tilePath ? (
                    <img
                      src={skin.tilePath}
                      alt={skin.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center border border-border">
                      <span className="text-foreground/40 text-xs">No preview</span>
                    </div>
                  )}

                  {/* Overlay badges */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {skin.isDownloaded && (
                      <Badge variant="secondary" className="text-xs">
                        Downloaded
                      </Badge>
                    )}
                    {skin.isFavorite && (
                      <Badge variant="secondary" className="text-xs">
                        ⭐
                      </Badge>
                    )}
                  </div>

                  {/* Skin name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-white text-sm font-medium line-clamp-2">{skin.name}</p>
                    {skin.rarity && (
                      <p className={cn('text-xs mt-1', getRarityColor(skin.rarity))}>
                        {skin.rarity}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border">
          <div className="flex items-center gap-2">
            {(hoveredSkin || selectedSkin) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-foreground/60 truncate max-w-[200px]"
              >
                {(hoveredSkin || selectedSkin)?.name}
              </motion.div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!selectedSkin} size="sm">
              Apply
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
