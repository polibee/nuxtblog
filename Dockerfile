# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
RUN groupadd --system --gid 1001 nuxtblog \
  && useradd --system --uid 1001 --gid nuxtblog nuxtblog
COPY --from=build --chown=nuxtblog:nuxtblog /app/.output ./.output
RUN mkdir -p /app/.data && chown nuxtblog:nuxtblog /app/.data
USER nuxtblog
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
