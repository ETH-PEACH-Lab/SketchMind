# Stage 1: Build frontend
FROM node:14
WORKDIR /app/frontend
COPY ./frontend/package*.json ./
RUN npm install
COPY .env ./
COPY ./frontend .
RUN npm run build

# Stage 2: Build backend
WORKDIR /app/backend
COPY ./backend/package*.json ./
RUN npm install 
COPY .env ./
COPY ./backend .

# Final stage: Run the application
WORKDIR /app

# Expose necessary ports
EXPOSE 4000
EXPOSE 3000

# Start both frontend and backend
CMD ["sh", "-c", "cd /app/backend && node index.js & cd /app/frontend && npm run dev"]
