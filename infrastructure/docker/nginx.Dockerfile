# Reverse proxy image — configuration is baked in (no host bind mounts needed).
FROM nginx:1.27-alpine
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/html/ /usr/share/nginx/html/
RUN nginx -t
