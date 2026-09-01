# Stage 1: Build static web distribution portal
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docs/logo.svg /usr/share/nginx/html/logo.svg

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
