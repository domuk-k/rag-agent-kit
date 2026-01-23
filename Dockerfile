FROM oven/bun:1 AS base

# Copy entire monorepo
WORKDIR /app
COPY . .

# Install dependencies at root level
RUN bun install

# Create data directory for SQLite
RUN mkdir -p /app/data

WORKDIR /app/apps/api
EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
