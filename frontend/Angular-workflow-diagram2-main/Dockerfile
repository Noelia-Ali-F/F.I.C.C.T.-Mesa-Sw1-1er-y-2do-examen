FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY env.js.template /etc/nginx/templates/env.js.template
ENV API_URL=""
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/workflow-frontend-angular/browser /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
