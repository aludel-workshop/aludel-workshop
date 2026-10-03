# JOURNEYS-01 J3: the image journey step tests run in. It holds a browser and Playwright, nothing from Aludel or the app:
# the host mounts its runner script and the candidate's `.aludel/journeys/` read-only at run time, so this file alone
# names the image (its tag is this file's digest). Keep the Playwright version and the base image's browsers in step.
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /runner
RUN npm init -y > /dev/null && npm install --no-audit --no-fund --omit=dev playwright-core@1.56.1 && npm cache clean --force
USER pwuser
