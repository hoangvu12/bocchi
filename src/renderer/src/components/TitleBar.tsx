import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'
import { DarkModeToggle } from './DarkModeToggle'
import { Button } from './ui/button'
import logoImg from '../assets/images/logo-small.png'

interface TitleBarProps {
  appVersion?: string
}

export function TitleBar({ appVersion }: TitleBarProps) {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.api.isWindowMaximized()
      setIsMaximized(maximized)
    }

    checkMaximized()

    // Check when window state changes
    const interval = setInterval(checkMaximized, 100)
    return () => clearInterval(interval)
  }, [])

  const handleMinimize = () => {
    window.api.minimizeWindow()
  }

  const handleMaximize = () => {
    window.api.maximizeWindow()
  }

  const handleClose = () => {
    window.api.closeWindow()
  }

  const handleOpenExternal = (url: string) => {
    window.api.openExternal(url)
  }

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-white dark:bg-charcoal-900 border-b-2 border-charcoal-200 dark:border-charcoal-800 flex items-center justify-between select-none z-50 shadow-md dark:shadow-none">
      <div
        className="flex-1 h-full flex items-center px-6"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Bocchi" className="w-5 h-5 object-contain" />
          <div className="flex items-baseline gap-2">
            <div className="text-sm font-bold text-charcoal-900 dark:text-charcoal-100 tracking-wide">
              Bocchi
            </div>
            {appVersion && (
              <div className="text-xs text-charcoal-500 dark:text-charcoal-500">v{appVersion}</div>
            )}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-2 px-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <DarkModeToggle />
        <LanguageSwitcher />

        {/* Social Links */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded"
            onClick={() => handleOpenExternal('https://discord.gg/frXDBTe4FW')}
            aria-label={t('social.joinDiscord')}
            title={t('social.joinDiscord')}
          >
            <svg
              className="w-4 h-4 text-charcoal-600 dark:text-charcoal-400 group-hover:text-[#5865F2] dark:group-hover:text-[#5865F2] transition-colors"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.037c-.211.375-.444.865-.608 1.249a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.249.077.077 0 0 0-.079-.037c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.027 19.839 19.839 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded"
            onClick={() => handleOpenExternal('https://github.com/hoangvu12/bocchi')}
            aria-label={t('social.viewGithub')}
            title={t('social.viewGithub')}
          >
            <svg
              className="w-4 h-4 text-charcoal-600 dark:text-charcoal-400 group-hover:text-charcoal-900 dark:group-hover:text-white transition-colors"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </Button>
        </div>
      </div>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-10 rounded-none"
          onClick={handleMinimize}
          aria-label={t('actions.minimize')}
        >
          <div className="w-3 h-[1.5px] bg-charcoal-400 dark:bg-charcoal-500 group-hover:bg-charcoal-600 dark:group-hover:bg-charcoal-300 transition-colors"></div>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-10 rounded-none"
          onClick={handleMaximize}
          aria-label={isMaximized ? t('actions.restore') : t('actions.maximize')}
        >
          <div
            className={`${isMaximized ? 'w-2.5 h-2.5 border-[1.5px] border-charcoal-400 dark:border-charcoal-500 group-hover:border-charcoal-600 dark:group-hover:border-charcoal-300' : 'w-3 h-3 border-[1.5px] border-charcoal-400 dark:border-charcoal-500 group-hover:border-charcoal-600 dark:group-hover:border-charcoal-300'} transition-colors rounded-[1px]`}
          ></div>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-10 rounded-none hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={handleClose}
          aria-label={t('actions.close')}
        >
          <svg
            className="w-3.5 h-3.5 text-charcoal-400 dark:text-charcoal-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors"
            viewBox="0 0 12 12"
          >
            <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
