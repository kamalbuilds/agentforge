# Build AXL node from source
# Reference: https://github.com/gensyn-ai/axl

FROM golang:1.25.5-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make bash

# Clone and build AXL
RUN git clone https://github.com/gensyn-ai/axl.git /axl && \
    cd /axl && \
    go build -o /axl-node ./cmd/node/

# Runtime image
FROM alpine:latest

# Install runtime dependencies (OpenSSL for key generation, ca-certs for HTTPS)
RUN apk add --no-cache openssl ca-certificates

# Copy compiled binary
COPY --from=builder /axl-node /usr/local/bin/axl-node

# Create working directory
WORKDIR /app

# Expose API port and P2P port
EXPOSE 9002 9001

# Copy config and entrypoint
COPY infra/axl/node-config.json /app/node-config.json
COPY infra/axl/genkey.sh /app/genkey.sh

RUN chmod +x /app/genkey.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:9002/health || exit 1

ENTRYPOINT ["/app/genkey.sh"]
