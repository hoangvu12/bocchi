import { useState, useEffect } from 'react'
import { X, Plus, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SortableList, { SortableItem } from 'react-easy-sort'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from './ui/select'

// Array move utility function
function arrayMoveImmutable<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array]
  const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex
  
  if (startIndex >= 0 && startIndex < array.length) {
    const endIndex = toIndex < 0 ? array.length + toIndex : toIndex
    const [item] = newArray.splice(fromIndex, 1)
    newArray.splice(endIndex, 0, item)
  }
  
  return newArray
}

interface Champion {
  id: number
  name: string
  alias?: string
}

interface ChampionSelectorProps {
  champions: Champion[]
  selectedChampionIds: number[]
  onChampionsChange: (championIds: number[]) => void
  maxChampions?: number
  label: string
}

export function ChampionSelector({
  champions,
  selectedChampionIds,
  onChampionsChange,
  maxChampions = 5,
  label
}: ChampionSelectorProps) {
  const { t } = useTranslation()
  const [selectedChampions, setSelectedChampions] = useState<number[]>(selectedChampionIds)

  useEffect(() => {
    setSelectedChampions(selectedChampionIds)
  }, [selectedChampionIds])

  const handleAddChampion = () => {
    if (selectedChampions.length < maxChampions) {
      setSelectedChampions([...selectedChampions, 0])
    }
  }

  const handleRemoveChampion = (index: number) => {
    const newChampions = selectedChampions.filter((_, i) => i !== index)
    setSelectedChampions(newChampions)
    onChampionsChange(newChampions.filter((id) => id > 0))
  }

  const handleChampionChange = (index: number, championId: number) => {
    const newChampions = [...selectedChampions]
    newChampions[index] = championId
    setSelectedChampions(newChampions)
    onChampionsChange(newChampions.filter((id) => id > 0))
  }

  const handleSortEnd = (oldIndex: number, newIndex: number) => {
    const newChampions = arrayMoveImmutable(selectedChampions, oldIndex, newIndex)
    setSelectedChampions(newChampions)
    onChampionsChange(newChampions.filter((id) => id > 0))
  }

  const getAvailableChampions = (currentIndex: number) => {
    // Get champions that are not already selected (except the current one)
    return champions.filter((champ) => {
      const isCurrentSelection = selectedChampions[currentIndex] === champ.id
      const isSelectedElsewhere = selectedChampions.some(
        (id, idx) => idx !== currentIndex && id === champ.id
      )
      return isCurrentSelection || !isSelectedElsewhere
    })
  }


  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-text-secondary mb-2">{label}</div>

      <SortableList 
        onSortEnd={handleSortEnd}
        className="space-y-2"
        draggedItemClassName="opacity-50"
      >
        {selectedChampions.map((championId, index) => {
          const champion = champions.find((c) => c.id === championId)
          const availableChampions = getAvailableChampions(index)

          return (
            <SortableItem key={`champion-${index}`}>
              <div className="flex items-center gap-2">
                <div className="flex items-center text-text-secondary cursor-move">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm ml-1">{index + 1}.</span>
                </div>

                <Select
                  value={championId.toString()}
                  onValueChange={(value) => handleChampionChange(index, parseInt(value))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue>
                      {champion ? (
                        <span>{champion.name}</span>
                      ) : (
                        <span className="text-text-secondary">{t('settings.selectChampion')}</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t('champion.allChampions')}</SelectLabel>
                      {availableChampions.map((champ) => (
                        <SelectItem key={champ.id} value={champ.id.toString()}>
                          <span>{champ.name}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveChampion(index)}
                  className="px-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </SortableItem>
          )
        })}
      </SortableList>

      {selectedChampions.length < maxChampions && (
        <Button variant="outline" size="sm" onClick={handleAddChampion} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          {t('settings.addChampion')}
        </Button>
      )}
    </div>
  )
}
