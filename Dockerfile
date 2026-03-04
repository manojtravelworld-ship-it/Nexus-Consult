# Use Node 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy all project files
COPY package*.json ./
RUN npm install
COPY . .

# Build the frontend
RUN npm run build

# Start the Express server
CMD ["npm", "start"]
