FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install --frozen-lockfile --production
COPY src/ ./src/
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e 'fetch("http://localhost:3000/api/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'
CMD ["bun", "src/index.ts"]
