### Etapa de build ###
FROM node:22-alpine AS build

WORKDIR /app
RUN npm install -g npm@12.0.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

### Etapa de runtime ###
FROM nginx:alpine AS runtime

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
