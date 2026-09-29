# ADR-006: In-App Updates from a Public Releases Repository

## Status
Accepted. Reverses the earlier decision (INT-DIST-002 before 2.0.0) that Crate ships no auto-updater.

## Context
Releases are cut from every non-chore merge to `main`, so an installed copy falls behind quickly, and updating meant downloading and running the Setup installer by hand each time. The source repository is private, so an installed app cannot fetch releases from it: that would need a credential shipped inside the binary, where anyone can extract it. Crate has two Windows builds, an NSIS Setup installer and a portable executable, and only the installed one can update itself.

## Decision
1. Use `electron-updater` with the GitHub provider, pointed at a separate **public** repository, `crate-releases`, which holds only release artifacts.
2. After each release, CI uploads the Setup installer, its `.blockmap` and `latest.yml` to `crate-releases`. The release is created as a draft and published last, so no client sees a version whose installer or `latest.yml` is still uploading. The portable executable is not published there.
3. An installed build checks 15 seconds after launch and then every 6 hours while it runs. Updates download in the background and install when the app quits (`autoInstallOnAppQuit`).
4. When a download finishes, the UI shows a non-blocking "Restart to update" banner. "Later" dismisses it for that version and the update still installs on quit. Playback is never interrupted. Settings has an Updates section with the current status and a manual check.
5. Updating is disabled for unpackaged runs and for the portable build (detected through `PORTABLE_EXECUTABLE_FILE`). The portable build shares the installed app's feed, so it would otherwise download the Setup installer and install a second copy.
6. The lifecycle lives in `electron/services/app-updater.ts` behind a narrow interface over electron-updater, and reaches the renderer through the `window.crateBridge` update methods.

## Consequences
- **Positive**: Installed users stay current without a manual download. The source repository stays private. Differential downloads keep updates small.
- **Negative**: Crate is unsigned, so the only integrity check is the SHA-512 in `latest.yml` fetched over HTTPS. Whoever can write to `crate-releases` can run code on every installed copy, so the token CI uses (`RELEASES_REPO_TOKEN`) must be scoped to that one repository. Code signing would add a real signature check.
- **Negative**: The installers are publicly downloadable.
- **Negative**: A per-machine install (Program Files) may need administrator approval for each update. A per-user install avoids that.
- **Negative**: The portable build must still be updated by hand.
- **Note**: The update check is Crate's only background network request. It sends no library data, and tagging and indexing remain offline (REQ-TAG-003).
