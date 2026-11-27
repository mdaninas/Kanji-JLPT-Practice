FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY Data/ ./Data/
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app

LABEL org.opencontainers.image.title="JLPT Atlas" \
      org.opencontainers.image.description="JLPT kanji and vocabulary practice with optional Claude quizzes" \
      org.opencontainers.image.source="https://github.com/mdaninas/Kanji-JLPT-Practice" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    SERVE_WEB=1 \
    HOST=0.0.0.0 \
    PORT=8787

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json LICENSE ./
COPY server/*.js ./server/
COPY src/languages.js src/quizModels.js ./src/
COPY src/utils/csv.js ./src/utils/
COPY Data/Vocabulary/ ./Data/Vocabulary/

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(response => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server/index.js"]
