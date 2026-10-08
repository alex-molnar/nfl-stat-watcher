# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The usage-metrics collector (docs/metrics.md): its own image, run beside the web container. It sits above the final stage so a plain build still makes the web image.
FROM node:22-alpine AS collector
WORKDIR /app
COPY collector ./collector
COPY src/metrics/events.ts ./src/metrics/events.ts
USER node
EXPOSE 9100
CMD ["node", "collector/main.ts"]

FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
USER 101
