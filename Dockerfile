FROM node:24-bookworm-slim AS deps

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund --ignore-scripts
RUN npx playwright install --with-deps chromium chromium-headless-shell

FROM deps AS builder

COPY . .

RUN npm run build

FROM deps AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=builder /app ./

EXPOSE 3000

CMD ["sh", "-c", "if [ \"${SERVICE_MODE:-web}\" = \"cron-refresh\" ]; then npm run cron:refresh-due; else npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}; fi"]
