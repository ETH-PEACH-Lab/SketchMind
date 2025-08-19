# Stage 1: Frontend setup
FROM node:14
WORKDIR /app/frontend
# Copy package files first for better caching
COPY ./frontend/package*.json ./
RUN npm install
# Copy source code
COPY ./frontend .

WORKDIR /app/backend
COPY ./backend/package*.json ./
RUN npm install
# Copy source code
COPY ./backend .
# Copy environment file
COPY .env ./

# Expose necessary ports
EXPOSE 4000
EXPOSE 3000

# Start both frontend and backend in development mode
CMD ["sh", "-c", "cd /app/backend && node index.js & cd /app/frontend && npm run dev"]
