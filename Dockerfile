# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Compilar TypeScript → dist/
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Solo instalar dependencias de producción
# Solo instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copiar artefactos compilados desde el builder
COPY --from=builder /app/dist ./dist
COPY serviceAccountKey.json ./

# Variables de entorno por defecto (se sobreescriben desde docker-compose)
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Arrancar la app NestJS compilada
CMD ["node", "dist/main"]
