# Aludel's dev environment (COLLAB-WORK-01 CW-3): the one definition a person's item container and, once AGENT-WORK-01 A2
# exists, the cloud agent's runner both start from. Nothing secret is built in: the Claude Code login and the Aludel token
# never enter the image: Claude Code's login lives in a shared volume the person signs in to once, and each item container
# connects itself to its one item (`aludel connect`).
FROM node:24-bookworm
ARG PLAYWRIGHT_VERSION=1.61.1
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl && rm -rf /var/lib/apt/lists/*
# Claude Code, and Chromium for the portal's browser journeys (the same Playwright the journeys load).
RUN npm install -g @anthropic-ai/claude-code playwright@${PLAYWRIGHT_VERSION} \
 && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright playwright install --with-deps chromium-headless-shell \
 && npm cache clean --force
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
# The Aludel tools are fetched from the portal at setup, and the container's own item token is kept beside them.
ENV PATH=/home/node/.aludel/tools:$PATH
# The shared Claude Code volume mounts here; created in the image so a new volume starts owned by node, not root.
RUN mkdir -p /home/node/.claude /home/node/.aludel/tools && chown -R node:node /home/node/.claude /home/node/.aludel
