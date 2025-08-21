# syntax=docker/dockerfile:1.6
FROM node:20-bullseye AS fe-build
WORKDIR /app/frontend
RUN corepack enable && npm i -g npm@latest && npm config set registry https://registry.npmjs.org/
COPY ./frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_TELEMETRY_DISABLED=1
COPY ./frontend .
RUN npm run build

FROM node:20-bullseye AS be-build
WORKDIR /app/backend
RUN corepack enable && npm i -g npm@latest && npm config set registry https://registry.npmjs.org/
COPY ./backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund
COPY ./backend .

FROM node:20-bullseye
WORKDIR /app
COPY --from=fe-build /app/frontend /app/frontend
COPY --from=be-build  /app/backend  /app/backend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ENV PORT=5095
EXPOSE 5090
EXPOSE 5095
SHELL ["/bin/bash", "-lc"]
CMD node /app/backend/index.js & cd /app/frontend && npx next start -H 0.0.0.0 -p 5090
