FROM node:22-alpine

WORKDIR /app

# Instalar dependencias nativas mínimas para Prisma en Alpine
RUN apk add --no-cache openssl libc6-compat

# Copiar manifiestos y optimizar instalación sin comprobaciones lentas
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copiar Prisma y generar el cliente
COPY prisma ./prisma
RUN npx prisma generate

# Copiar el código fuente
COPY . .

EXPOSE 3000

# Sincronización automática de base de datos e inicio en desarrollo
CMD ["sh", "-c", "npx prisma db push && npm run start:dev"]
