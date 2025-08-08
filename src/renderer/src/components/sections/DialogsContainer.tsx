import { useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { UpdateDialog } from '../UpdateDialog'
import { ChampionDataUpdateDialog } from '../ChampionDataUpdateDialog'
import { EditCustomSkinDialog } from '../EditCustomSkinDialog'
import { DownloadedSkinsDialog } from '../DownloadedSkinsDialog'
import { FileTransferDialog } from '../FileTransferDialog'
import { SettingsDialog } from '../SettingsDialog'
import { PresetsDialog } from '../PresetsDialog'
import { showUpdateDialogAtom, statusMessageAtom } from '../../store/atoms/game.atoms'
import { showChampionDataUpdateAtom } from '../../store/atoms/champion.atoms'
import {
  showEditDialogAtom,
  editingCustomSkinAtom,
  showDownloadedSkinsDialogAtom,
  showSettingsDialogAtom
} from '../../store/atoms/ui.atoms'
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom
} from '../../store/atoms/settings.atoms'
import { useChampionData } from '../../hooks/useChampionData'
import { useSkinManagement } from '../../hooks/useSkinManagement'
export function DialogsContainer() {
  const { championData, updateChampionData, isUpdatingChampionData } = useChampionData()
  const { downloadedSkins, loadDownloadedSkins, deleteDownloadedSkin, deleteCustomSkin } =
    useSkinManagement()

  const [showUpdateDialog, setShowUpdateDialog] = useAtom(showUpdateDialogAtom)
  const [showChampionDataUpdate, setShowChampionDataUpdate] = useAtom(showChampionDataUpdateAtom)
  const [showEditDialog, setShowEditDialog] = useAtom(showEditDialogAtom)
  const [editingCustomSkin, setEditingCustomSkin] = useAtom(editingCustomSkinAtom)
  const [showDownloadedSkinsDialog, setShowDownloadedSkinsDialog] = useAtom(
    showDownloadedSkinsDialogAtom
  )
  const [showSettingsDialog, setShowSettingsDialog] = useAtom(showSettingsDialogAtom)
  const [, setLeagueClientEnabled] = useAtom(leagueClientEnabledAtom)
  const [, setChampionDetectionEnabled] = useAtom(championDetectionEnabledAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)

  const handleEditCustomSkinSave = useCallback(
    async (newName: string, newImagePath?: string) => {
      if (!editingCustomSkin) return

      const result = await window.api.editCustomSkin(editingCustomSkin.path, newName, newImagePath)

      if (result.success) {
        await loadDownloadedSkins()
        setStatusMessage(`Updated custom mod: ${newName}`)
      } else {
        setStatusMessage(`Failed to update mod: ${result.error}`)
      }

      setShowEditDialog(false)
      setEditingCustomSkin(null)
    },
    [
      editingCustomSkin,
      loadDownloadedSkins,
      setStatusMessage,
      setShowEditDialog,
      setEditingCustomSkin
    ]
  )

  return (
    <>
      <UpdateDialog isOpen={showUpdateDialog} onClose={() => setShowUpdateDialog(false)} />

      <ChampionDataUpdateDialog
        isOpen={showChampionDataUpdate}
        onUpdate={updateChampionData}
        onSkip={() => setShowChampionDataUpdate(false)}
        currentVersion={championData?.version}
        isUpdating={isUpdatingChampionData}
      />

      {editingCustomSkin && (
        <EditCustomSkinDialog
          isOpen={showEditDialog}
          currentName={editingCustomSkin.name}
          modPath={editingCustomSkin.path}
          onClose={() => {
            setShowEditDialog(false)
            setEditingCustomSkin(null)
          }}
          onSave={handleEditCustomSkinSave}
          onFixComplete={async () => {
            await loadDownloadedSkins()
            setStatusMessage('Mod fixed successfully')
          }}
        />
      )}

      <DownloadedSkinsDialog
        isOpen={showDownloadedSkinsDialog}
        onClose={() => setShowDownloadedSkinsDialog(false)}
        downloadedSkins={downloadedSkins}
        championData={championData || undefined}
        onDeleteSkin={deleteDownloadedSkin}
        onDeleteCustomSkin={deleteCustomSkin}
        onRefresh={loadDownloadedSkins}
      />

      <FileTransferDialog championData={championData || undefined} />

      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onLeagueClientChange={(enabled) => setLeagueClientEnabled(enabled)}
        onChampionDetectionChange={(enabled) => setChampionDetectionEnabled(enabled)}
      />

      <PresetsDialog />
    </>
  )
}
