# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@11.15.1 --prefer-offline || npm install -g pnpm@11.15.1
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

CMD ["pnpm", "start"]
