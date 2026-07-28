FROM node:22-alpine AS verified

WORKDIR /app
COPY . .
RUN node --test && node --check app/main.mjs

FROM node:22-alpine

WORKDIR /app
COPY --from=verified /app/package.json ./
COPY --from=verified /app/config.mjs ./
COPY --from=verified /app/ai ./ai
COPY --from=verified /app/app ./app
COPY --from=verified /app/bot ./bot
COPY --from=verified /app/commands ./commands
COPY --from=verified /app/knowledge ./knowledge
COPY --from=verified /app/logging ./logging
COPY --from=verified /app/personality ./personality
COPY --from=verified /app/safety ./safety
COPY --from=verified /app/scripts ./scripts
COPY --from=verified /app/status ./status
COPY --from=verified /app/youtube ./youtube

USER node
CMD ["node", "app/main.mjs"]
