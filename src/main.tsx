import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled by Vite, so the font is addressed relative to the page like everything else (D14).
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
