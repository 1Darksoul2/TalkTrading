# The public entry point: builds the React app and serves it, together with every API, from one
# HTTPS address through Caddy (automatic Let's Encrypt certificates).
# Build context: the project root.

# 1) Frontend production build. Every service is reached through the same origin under /svc/<name>.
FROM node:22-alpine AS frontend
ARG PUBLIC_URL
WORKDIR /app
COPY TalkTrading-main/TalkTrading-main/package.json TalkTrading-main/TalkTrading-main/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY TalkTrading-main/TalkTrading-main/ ./
ENV VITE_NEWS_SERVICE_URL=${PUBLIC_URL}/svc/news \
    VITE_STORY_SERVICE_URL=${PUBLIC_URL}/svc/story \
    VITE_CHART_SERVICE_URL=${PUBLIC_URL}/svc/chart \
    VITE_E2EE_SERVICE_URL=${PUBLIC_URL}/svc/e2ee \
    VITE_POST_SERVICE_URL=${PUBLIC_URL}/svc/post \
    VITE_COMMUNITY_SERVICE_URL=${PUBLIC_URL}/svc/community \
    VITE_EXPLORE_SERVICE_URL=${PUBLIC_URL}/svc/explore
RUN npm run build

# 2) Caddy with the rate-limit plugin (not in the standard image).
FROM caddy:2.10-builder AS caddy
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

# 3) Final image.
FROM caddy:2.10
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=frontend /app/dist /srv/app
COPY deploy/Caddyfile /etc/caddy/Caddyfile
