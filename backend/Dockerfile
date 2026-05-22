# =====================================================================
# 星创想英语作业 - NestJS 后端 / 微信云托管镜像
#   多阶段构建：deps → builder → runner
#   启动流程：docker-entrypoint.sh → prisma db push → node dist/main.js
# =====================================================================

# ---------- 1) 安装依赖 + 生成 Prisma Client ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Alpine 上 Prisma 需要 openssl
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ---------- 2) 编译 TypeScript ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 3) 运行时镜像（最小化） ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/data ./data
COPY --from=builder /app/package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# 云托管约定端口（也可通过环境变量 PORT 覆盖）
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
