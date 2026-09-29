# ADR-006: In-App Updates from This Repository's Public Releases

## Status
Accepted. Reverses the earlier decision (INT-DIST-002 before 2.0.0) that Crate ships no auto-updater.

## Context
Releases are cut from every non-chore merge to `main`, so an installed copy falls behind quickly, and updating meant downloading and running the Setup installer by hand each time. Crate's releases are published as GitHub Releases on this repository. An installed app can only read them without a credential if the repository is public, and shipping a credential inside the binary would expose it to anyone. Crate has two Windows builds, an NSIS Setup installer and a portable executable, and only the installed one can update itself.

## Decision
1. Use `electron-updater` with the GitHub provider, reading this repository's releases (`PSA-Department-of-Engineering/crate`). This requires the repository to be public.
2. CI uploads the Setup installer, its `.blockmap` and `latest.yml` to each release, alongside the existing artifacts. `latest.yml` is uploaded last, after the files it points at.
3. An installed build checks 15 seconds after launch and then every 6 hours while it runs. Updates download in the background and install when the app quits (`autoInstallOnAppQuit`).
4. When a download finishes, the UI shows a non-blocking "Restart to update" banner. "Later" dismisses it for that version and the update still installs on quit. Playback is never interrupted. Settings has an Updates section with the current status and a manual check.
5. Updating is disabled for unpackaged runs and for the portable build (detected through `PORTABLE_EXECUTABLE_FILE`). The portable build shares the installed app's feed, so it would otherwise download the Setup installer and install a second copy.
6. The lifecycle lives in `electron/services/app-updater.ts` behind a narrow interface over electron-updater, and reaches the renderer through the `window.crateBridge` update methods.

## Consequences
- **Positive**: Installed users stay current without a manual download. There is no second repository, no extra token, and no new secret: CI uses the token it already has. Differential downloads keep updates small.
- **Negative**: The repository must stay public. Its source, history, issues and Actions logs are visible, and the installers are publicly downloadable. If it is made private again, installed copies stop finding updates and report an error in Settings.
- **Negative**: Crate is unsigned, so the only integrity check is the SHA-512 in `latest.yml` fetched over HTTPS. Anyone who can edit this repository's releases can run code on every installed copy, so write access to the repository is the trust boundary. Code signing would add a real signature check.
- **Negative**: The release is published before CI finishes uploading, so a check in that window finds no `latest.yml` and reports an error until the next check. Uploading `latest.yml` last means a client never sees a half-uploaded version.
- **Negative**: A per-machine install (Program Files) may need administrator approval for each update. A per-user install avoids that.
- **Negative**: The portable build must still be updated by hand.
- **Note**: The update check is Crate's only background network request. It sends no library data, and tagging and indexing remain offline (REQ-TAG-003).
