#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

command -v node >/dev/null || { echo 'Node.js 24+ is required'; exit 1; }
command -v npm >/dev/null || { echo 'npm is required'; exit 1; }
command -v pm2 >/dev/null || { echo 'PM2 is required: npm install -g pm2'; exit 1; }

test -f .env || { echo 'Missing .env; copy .env.example and configure MySQL first'; exit 1; }

npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 save
echo 'NuxtBlog is running under PM2.'
echo 'Run "pm2 startup" once and execute the printed command to enable boot restore.'
