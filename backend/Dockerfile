### Etapa de build ###
FROM node:22-alpine AS build

WORKDIR /app
RUN npm install -g npm@12.0.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

### Etapa de desarrollo (watch mode con `nest start --watch`) — no se usa en
### producción, ver docker-compose-dev.yml y docs/13-despliegue-y-operacion.md. ###
FROM build AS dev

COPY entrypoint.dev.sh ./entrypoint.dev.sh
RUN chmod +x ./entrypoint.dev.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.dev.sh"]

### Etapa de runtime ###
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g npm@12.0.1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
