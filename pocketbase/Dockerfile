# Avoid `apk add` during build: Alpine package mirrors often fail with
# TLS errors in constrained Docker environments. BusyBox already ships
# unzip/wget; PocketBase is a static Go binary.
FROM alpine:3.21 AS certs
# Use CA bundle from the base image (no package install required)

FROM busybox:1.36

ARG PB_VERSION=0.36.1

# TLS trust store for outbound HTTPS from PocketBase (OAuth, webhooks, etc.)
COPY --from=certs /etc/ssl/certs/ /etc/ssl/certs/

# Docker host fetches this URL (not apk); unzip comes from busybox
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN mkdir -p /pb \
    && unzip /tmp/pb.zip -d /pb/ \
    && rm -f /tmp/pb.zip \
    && chmod +x /pb/pocketbase

COPY ./pb_migrations /pb/pb_migrations

EXPOSE 8080

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
