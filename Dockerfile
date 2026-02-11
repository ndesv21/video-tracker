FROM node:20-slim

# Install system Chromium + dependencies for Puppeteer
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium fonts-liberation libgbm1 libnss3 libatk-bridge2.0-0 libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer downloading its own Chromium — use system one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npx puppeteer browsers clear

COPY . .
RUN npm run build

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
