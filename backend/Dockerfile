# Backend image for Render / Railway. Bundles ffmpeg so the video pipeline
# (Feature 14) works in production.
FROM node:20-slim

# ffmpeg for video rendering; openssl for Prisma engines.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). Schema is needed for prisma generate.
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Sync the schema on boot (idempotent), then start the API + worker.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
