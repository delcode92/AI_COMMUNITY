# Docker vs Podman

**Context:** Container runtime choices for AI agent deployments.

## Overview

| Feature | Docker | Podman |
|---------|--------|--------|
| Daemon | Required (root) | Daemonless |
| Rootless | Possible | Native |
| Compatibility | OCI + Docker APIs | OCI + Docker APIs |
| Kubernetes | Docker Desktop / Docker Hub | Built-in Pod support |
| Security | Root-by-default | Rootless-by-default |

## For AI Agents

### Docker
**Best for:** Development simplicity, Docker Hub integration, ecosystem support

### Podman
**Best for:** Production security, rootless containers, Kubernetes compatibility

## Recommendation

For Cooney and similar AI applications, both work. Docker is simpler for local dev; Podman offers better security model for production.

---

*Notes on container choices for our AI projects.*
