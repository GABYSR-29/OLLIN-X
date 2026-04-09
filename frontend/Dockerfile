# Producción — Google Cloud Run (PORT lo define Cloud Run; por defecto 8080)
FROM node:18

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
# En runtime (p. ej. Cloud Run servicio frontend): URL pública del backend para el navegador
ARG PUBLIC_API_URL=
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN npm run build

RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
