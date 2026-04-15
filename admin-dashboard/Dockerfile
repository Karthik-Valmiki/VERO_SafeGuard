# --- Stage 1: Install dependencies (cached separately from source) ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- Stage 2: Build production bundle (source copied here, never cached with deps) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_ADMIN_USER
ARG VITE_ADMIN_PASS
ARG VITE_ADMIN_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_USER=$VITE_ADMIN_USER
ENV VITE_ADMIN_PASS=$VITE_ADMIN_PASS
ENV VITE_ADMIN_API_KEY=$VITE_ADMIN_API_KEY
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# --- Stage 3: Serve with nginx ---
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
