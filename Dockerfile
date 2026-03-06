# 1. Use a standard Node image
FROM node:20-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files first to leverage Docker cache
# Ensure package.json is in the same folder as this Dockerfile
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of your application code
COPY . .

# 6. Build and start (adjust according to your package.json scripts)
RUN npm run build
CMD ["npm", "start"]
