# Crate

Windows desktop music manager and car sync engine for MP3/FLAC collections.

## Run with Docker

The desktop app itself has no server-side component of its own; this repo serves two containers, the app's landing/download web portal and its docs site:

``bash
docker compose -f devops/docker-compose.yml up --build   # web portal, http://localhost:8080
docker build -f docs/Dockerfile -t crate-docs docs/ && docker run -p 8081:80 crate-docs
``

## Develop without Docker

The desktop app runs locally via Node and Electron:

``bash
npm install
npm run dev             # starts Vite dev server
npm start               # launches Electron desktop app
``

## Test

``bash
npm test                # vitest - full test suite attesting intent claims
``

## Package (Windows Desktop App)

``bash
npm run package         # builds Vite frontend, compiles Electron main/preload, packages Windows executable into dist/
``

## Layout

- src/ - React frontend application and UI components
- lectron/ - Electron main process, IPC handlers, metadata parsing, and USB sync engine
- 	ests/ - Vitest test suite attesting claims in intent.yaml
- docs/ - Documentation and installation guide
- devops/ - Dockerfile and compose for the web distribution portal
- k8s/ - Helm chart published by CI for Foundry GitOps delivery
- intent.yaml - CSD-INTENT-01 claims
- .github/workflows/build.yml - Thin caller of shared CI workflow
- .github/workflows/test.yml - Intent audit and test suite

## Commits

Every commit follows the platform's commit convention: a Conventional Commit
subject and no co-author trailer. CI derives the version from the type and
blocks release otherwise. The convention is documented on the platform
portal's GitOps delivery page, under "Commit convention"; the committed
.pre-commit-config.yaml checks it locally once installed (pre-commit install).
