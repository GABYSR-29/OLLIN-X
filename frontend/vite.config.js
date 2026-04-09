import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Con base:'./' Vite emite ./runtime-config.js; desde /simulator eso resuelve mal y no carga la URL del API.
    {
      name: 'ollinx-runtime-config-root',
      transformIndexHtml(html) {
        return html.replaceAll('./runtime-config.js', '/runtime-config.js');
      },
    },
  ],
  base: './',
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber'],
    // No pre-empaquetar drei: evita un único .vite/deps/@react-three_drei.js que algunos antivirus
    // (p. ej. Norton) marcan como falso positivo y ponen en cuarentena → 504 Outdated Optimize Dep.
    exclude: ['@react-three/drei'],
  },
  server: {
    // Desarrollo: usa `npm run dev` y la URL que imprime Vite (p. ej. http://localhost:5173).
    // `npm start` sirve `dist/` en el puerto 8080 sin hot reload; los cambios en src no se ven hasta `vite build`.
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
    },
    proxy: {
      '/api': {
        // Alineado con PORT del backend (p. ej. .env en la raíz del repo o backend/.env)
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
