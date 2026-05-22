#!/bin/sh
set -e

# ---------------------------------------------------------------
# 启动逻辑：
# 1) 若未显式提供 DATABASE_URL，则尝试从云托管约定的 MYSQL_* 变量拼接
# 2) 用 prisma db push 把 schema 直接同步到数据库（MVP 阶段无需 migration 历史）
# 3) 从 data/curriculum.yaml 同步整学期作业到数据库（幂等）
# 4) 启动 Nest 应用
# ---------------------------------------------------------------

if [ -z "$DATABASE_URL" ] && [ -n "$MYSQL_ADDRESS" ]; then
  export DATABASE_URL="mysql://${MYSQL_USERNAME}:${MYSQL_PASSWORD}@${MYSQL_ADDRESS}/${MYSQL_DATABASE}"
  echo "[entrypoint] 由 MYSQL_* 环境变量拼接 DATABASE_URL"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: 未检测到 DATABASE_URL 也无 MYSQL_ADDRESS，无法启动" >&2
  exit 1
fi

echo "[entrypoint] 同步 Prisma schema 到数据库..."
npx prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] 从 curriculum.yaml 同步整学期作业..."
node dist/scripts/sync-curriculum.js || {
  echo "[entrypoint] WARN: 作业同步失败，但仍尝试启动服务（可能 YAML 文件缺失或损坏）" >&2
}

echo "[entrypoint] 启动 NestJS..."
exec node dist/main.js
