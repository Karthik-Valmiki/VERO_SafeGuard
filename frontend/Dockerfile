# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# --- Stage 2: Development (Vite HMR — not used in docker-compose prod flow) ---
FROM base AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Stage 3: Build production bundle ---
FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# --- Stage 4: Serve with nginx ---
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
