# Code Duel sandbox: go-judge + Node.js LTS + Python 3.
# Follows the official multi-stage pattern from https://docs.goj.ac/install
# (copy the go-judge binary out of the official image into a base image with the runtimes).

ARG GO_JUDGE_VERSION=v1.14.1
ARG NODE_VERSION=26.13.1

FROM criyle/go-judge:${GO_JUDGE_VERSION} AS go-judge
FROM node:${NODE_VERSION}-trixie-slim AS node

FROM debian:trixie-slim

# Python 3 (Debian 13 ships 3.13) and libatomic1 (needed by the node binary).
# No recommends: keeps the image small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 libatomic1 \
  && rm -rf /var/lib/apt/lists/*

# Only the node binary is needed to run code (no npm/corepack).
COPY --from=node /usr/local/bin/node /usr/local/bin/node

WORKDIR /opt
COPY --from=go-judge /opt/go-judge /opt/go-judge
COPY mount.yaml passwd /opt/

EXPOSE 5050/tcp
ENTRYPOINT ["/opt/go-judge", "-mount-conf", "/opt/mount.yaml"]
