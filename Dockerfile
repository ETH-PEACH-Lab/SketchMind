# syntax=docker/dockerfile:1.6

############################
# Stage 1: Frontend deps & build
############################
FROM node:20-bullseye AS frontend
WORKDIR /app/frontend

# 更稳的 npm 与网络设置
RUN corepack enable && npm i -g npm@latest
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 120000 \
 && npm config set registry https://registry.npmjs.org/

# 只拷 lockfile 以最大化缓存命中
COPY ./frontend/package*.json ./

# 利用 BuildKit 缓存 npm 缓存目录，加速/抗抖
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# 再拷源码，避免频繁失效依赖层缓存
COPY ./frontend .

# 如果需要构建（例如 Next.js、Vite 构建资源），保留 npm run build
# 若前端只跑 dev，可注释掉
# RUN npm run build || true

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

# 如果有编译步骤（tsc 等），在这里运行
# RUN npm run build

# 需要环境变量的话，这里不拷 .env（放最终镜像），避免泄漏在中间层
# 仅确认 backend 能启动所需文件已就位

############################
# Stage 3: Final image (dev run: 前后端同时跑)
############################
FROM node:20-bullseye
WORKDIR /app

# 拷环境变量文件（可改为运行时挂载）
COPY .env ./

# 前端 & 后端放到最终镜像
COPY --from=frontend /app/frontend /app/frontend
COPY --from=backend  /app/backend  /app/backend

# 需要的话：把前端构建产物放在固定目录（例如 Next 会用 .next）
# 这里保持和你的结构一致

# 暴露端口
EXPOSE 4000
EXPOSE 3000

# 同时起后端与前端 dev（与你原先逻辑一致）
# 如果 shell 不支持 && 的并发后台符号，确保使用 bash
SHELL ["/bin/bash", "-lc"]
CMD node /app/backend/index.js & cd /app/frontend && npm run dev
