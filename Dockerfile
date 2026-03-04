# Use Node 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files and install
COPY package*.json ./
RUN npm install

# Copy all project files (including server.ts)
COPY . .

# Build the frontend assets
RUN npm run build

# Expose the port (Railway typically uses 3000 or a dynamic PORT)
EXPOSE 3000

# Start the server using tsx as defined in your package.json
CMD ["npm", "start"]
