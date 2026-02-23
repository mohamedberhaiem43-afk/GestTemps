FROM node:20-alpine AS build
WORKDIR /app

COPY ["abrpoint.client/package.json", "abrpoint.client/package-lock.json*", "./"]
RUN npm install

COPY abrpoint.client/ ./

# Override env vars for Docker build
ARG VITE_REACT_APP_API_URL=/api
ENV VITE_API_URL=$VITE_REACT_APP_API_URL
ENV DOCKER_BUILD=true

# Build will use the ENV variable, overriding .env files
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY abrpoint.client/nginx.client.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]