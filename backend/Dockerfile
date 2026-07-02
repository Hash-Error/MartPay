# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies to build TS
RUN npm ci

COPY . .

# Generate Prisma Client types
RUN npx prisma generate

# Build the NestJS TypeScript application
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# Stage 2: Production runner environment
FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
