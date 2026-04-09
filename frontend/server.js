import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 8080;

const dist = path.join(__dirname, 'dist');

/**
 * URL del backend para el navegador (sin barra final).
 * Prioridad: PUBLIC_API_URL → VITE_API_URL (variables de entorno en runtime del contenedor).
 * Así el frontend en Cloud Run puede apuntar al backend sin reconstruir la imagen.
 */
app.get('/runtime-config.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const raw = (process.env.PUBLIC_API_URL || process.env.VITE_API_URL || '').trim();
  const base = raw.replace(/\/$/, '');
  res.type('application/javascript').send(
    `window.__OLLINX_API_BASE__=${JSON.stringify(base)};`
  );
});

app.use(express.static(dist, { index: false }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).send('API no configurada en este servicio');
  }
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.listen(port, '0.0.0.0', () => {
  const cfg = (process.env.PUBLIC_API_URL || process.env.VITE_API_URL || '').trim();
  console.log(`OllinX frontend estático en http://0.0.0.0:${port}`);
  console.log(
    '[frontend] runtime-config.js usará base de API:',
    cfg ? `(longitud ${cfg.length}, sin mostrar valor)` : '(vacío: revisa PUBLIC_API_URL o VITE_API_URL en el contenedor)'
  );
});
