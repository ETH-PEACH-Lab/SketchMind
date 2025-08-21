# syntax=docker/dockerfile:1.6

############################
# Stage 1: Frontend deps & build
############################
FROM node:20-bullseye AS frontend
WORKDIR /app/frontend

RUN corepack enable && npm i -g npm@latest
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 120000 \
 && npm config set registry https://registry.npmjs.org/

COPY ./frontend/package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY ./frontend .

RUN npm run build || true

############################
# Stage 2: Backend deps
############################
FROM node:20-bullseye AS backend
WORKDIR /app/backend

RUN corepack enable && npm i -g npm@latest
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 120000 \
 && npm config set registry https://registry.npmjs.org/

COPY ./backend/package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY ./backend .

############################
# Stage 3: Final image (dev run: 前后端同时跑)
############################
FROM node:20-bullseye
WORKDIR /app

COPY .env ./

COPY --from=frontend /app/frontend /app/frontend
COPY --from=backend  /app/backend  /app/backend


EXPOSE 4000
EXPOSE 3000

SHELL ["/bin/bash", "-lc"]
CMD node /app/backend/index.js & cd /app/frontend && npm run dev
