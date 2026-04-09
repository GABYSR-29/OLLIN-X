import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getApiBaseUrl } from './config/api'

if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => {
    console.log('[OllinX dev] HMR: módulos actualizados tras guardar', Date.now())
  })
}

console.log('[OllinX] ENV VITE_API_URL:', import.meta.env.VITE_API_URL ?? '(undefined)')
if (typeof window !== 'undefined') {
  console.log(
    '[OllinX] window.__OLLINX_API_BASE__ (post runtime-config):',
    window.__OLLINX_API_BASE__ !== undefined && window.__OLLINX_API_BASE__ !== ''
      ? window.__OLLINX_API_BASE__
      : '(vacío; se usará VITE_API_URL del build o rutas /api relativas)'
  )
  console.log('[OllinX] API base efectiva tras init:', getApiBaseUrl() || '(vacío)')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
