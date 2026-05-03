# AXL Node (Gensyn)

This directory contains the AXL node setup for AgentForge. The AXL node is a P2P messaging layer built on Yggdrasil that enables agents to exchange lifecycle, breeding, and arena messages across the network.

## Build

The AXL node is compiled from source using Go 1.25.5:

```bash
docker build -t axl-node:latest .
```

## Run Standalone

Generate a key and start the node:

```bash
docker run -d \
  --name axl-node \
  -p 9001:9001 \
  -p 9002:9002 \
  -v ./private.pem:/app/private.pem \
  axl-node:latest
```

The node will:
- Listen for P2P connections on TCP port 9001
- Serve HTTP API on port 9002

## Configuration

Edit `node-config.json` to:
- Add peer nodes via the `peers` array (format: `tcp://ip:port` or `tls://ip:port`)
- Change API/P2P listen addresses
- Configure MCP Router or A2A server (optional)

Example with a peer:

```json
{
  "peers": [
    "tls://example.com:9001"
  ]
}
```

## Network

The node generates an ed25519 identity automatically on first startup. The key is stored at `/app/private.pem` and can be reused across restarts.

To peer with another AXL node:
1. Exchange node addresses (format: `tls://ip:port`)
2. Add to each other's `peers` array in `node-config.json`
3. Restart both nodes

## Health Check

The Docker image includes a health check that probes the HTTP API:

```bash
curl http://localhost:9002/health
```
