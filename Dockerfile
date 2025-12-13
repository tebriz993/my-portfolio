# Dockerfile (TƏMİZ VƏ STANDART VERSİYA)

# --- Mərhələ 1: Build ---
FROM node:18-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Mərhələ 2: Production ---
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=build-stage /app/dist ./dist
EXPOSE 5000
CMD [ "node", "dist/index.js" ]