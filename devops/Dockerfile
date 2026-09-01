# The app image (crate-app): a static download/landing page for the
# desktop shell (the shell itself has no server-side component - it ships as a
# Windows installer on GitHub Releases, DIST-001). The docs site is a separate
# image (docs/Dockerfile); this page links to it rather than duplicating it.
FROM nginx:1.27-alpine
COPY app/index.html /usr/share/nginx/html/index.html
