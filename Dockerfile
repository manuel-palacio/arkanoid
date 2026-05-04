# Multi-stage build: Vite produces static assets, nginx serves them.
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps with cache-friendly layering.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Build.
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

# Custom nginx config tuned for an SPA: gzip, cache static assets, single-page fallback.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
