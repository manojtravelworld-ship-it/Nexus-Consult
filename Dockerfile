# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application
FROM node:20-alpine AS runner

# Set the working directory
WORKDIR /app

# Install the 'serve' package globally to serve static files
RUN npm install -g serve

# Copy the built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Railway provides the PORT environment variable dynamically.
# We set a default of 3000 just in case it's run locally.
ENV PORT=3000

# Expose the port
EXPOSE ${PORT}

# Start the server, binding to 0.0.0.0 and the specified PORT
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
