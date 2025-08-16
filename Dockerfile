FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd backend && npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p backend/uploads

# Expose ports
EXPOSE 3000 4000

# Start both services
CMD ["sh", "-c", "cd backend && node index.js & cd .. && npm start"]
