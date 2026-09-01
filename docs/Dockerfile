# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
ARG DOCS_BASE=/
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV DOCS_BASE=${DOCS_BASE}
RUN npm run build

FROM nginx:1.27-alpine
ARG DOCS_BASE=/
COPY --from=build /app/dist /usr/share/nginx/html${DOCS_BASE}
