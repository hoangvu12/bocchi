import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'jotai'
import App from './App'
import { defaultDarkTheme } from '../themes/themes'
import { applyTheme } from '../themes/utils'
import '../assets/base.css'
import '../assets/main.css'

// Apply theme classes before React renders
const root = document.documentElement

// Add overlay-specific class FIRST (before theme)
root.classList.add('overlay-window')

// Apply default dark theme initially
applyTheme(defaultDarkTheme)

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
)
