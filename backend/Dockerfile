FROM node:20-bookworm-slim

# better-sqlite3 compiles a native addon at install time, so we need build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data

EXPOSE 4000
CMD ["node", "src/server.js"]
