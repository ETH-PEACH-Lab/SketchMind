# Stage 1: Frontend setup
FROM node:16-alpine AS frontend-setup
WORKDIR /app/frontend

# Copy package files first for better caching
COPY ./frontend/package*.json ./
RUN npm install

# Copy source code
COPY ./frontend .

# Stage 2: Backend setup
FROM node:16-alpine AS backend-setup
WORKDIR /app/backend

# Copy package files first for better caching
COPY ./backend/package*.json ./
RUN npm install

# Copy source code
COPY ./backend .

# Final stage: Development runtime
FROM node:16-alpine AS development
WORKDIR /app

# Copy frontend
COPY --from=frontend-setup /app/frontend ./frontend

# Copy backend
COPY --from=backend-setup /app/backend ./backend

# Copy environment file
COPY .env ./

# Install dependencies in final stage
WORKDIR /app/frontend
RUN npm install

WORKDIR /app/backend
RUN npm install

# Set working directory back to app root
WORKDIR /app

# Expose necessary ports
EXPOSE 4000
EXPOSE 3000

# Start both frontend and backend in development mode
CMD ["sh", "-c", "cd /app/backend && node index.js & cd /app/frontend && npm run dev"]
