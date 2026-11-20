# Code Duel renderer: Node 24 (slim) + Playwright's Chromium headless shell ONLY.
# No full Playwright image (it ships three browsers): just the shell binary, the shared libraries
# it links against, and one fixed font family (DejaVu) so renders are deterministic.
FROM node:24-trixie-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOME=/tmp

WORKDIR /app
COPY package.json package-lock.json ./

# 1. npm deps without install scripts. 2. Download the Chromium headless shell into the image
#    (an explicit build step, not an npm postinstall). 3. Only the libraries the shell links
#    against (checked with `ldd`) + fontconfig and DejaVu fonts. Cleanup happens in the same
#    layer so nothing temporary stays in the image.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npx --no-install playwright-core install --only-shell chromium \
 && rm -rf /ms-playwright/ffmpeg-* \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libdbus-1-3 libdrm2 \
      libexpat1 libglib2.0-0t64 libnspr4 libnss3 libx11-6 libxcb1 libxcomposite1 libxdamage1 \
      libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
      fontconfig fonts-dejavu-core \
 # libgbm.so.1 is linked by the shell but only used with a GPU (rendering here is CPU-only). Its
 # package depends on Mesa + LLVM (~195 MB), which libgbm.so.1 itself doesn't link (it dlopens
 # GPU backends on demand), so extract just that package's files.
 && cd /tmp && apt-get download libgbm1 && dpkg -x libgbm1_*.deb / && ldconfig && cd /app \
 && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/* /usr/share/doc/* /usr/share/man/*

# Generic families (serif, sans-serif, monospace, …) all resolve to DejaVu.
COPY fontconfig/local.conf /etc/fonts/local.conf
COPY src ./src

USER node
EXPOSE 5070
CMD ["node", "src/server.js"]
