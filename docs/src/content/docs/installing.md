---
title: "Installation & SmartScreen Guide"
type: Guide
summary: "How to download, verify, and install Crate on Windows."
---

## System Requirements

- **Operating System**: Windows 10 (1809+) or Windows 11 (64-bit x86_64)
- **Memory**: 4 GB RAM minimum
- **Disk Space**: ~150 MB for application files + storage for music collection

## Steps to Run

1. Download Crate-Portable-1.0.0.exe or Crate-Setup-1.0.0.exe.
2. On initial launch, if Windows Defender SmartScreen appears:
   - Click **More info**.
   - Verify publisher is **PSA Department of Engineering / Crate**.
   - Click **Run anyway**.

## Updating Crate

- **Setup (installed) build**: updates itself. Crate checks for a newer version shortly after launch and every few hours while it runs, and downloads it in the background. When it is ready, a **Restart to update** banner appears. Choose **Later** and the update installs the next time you quit. **Settings > Updates** shows the current status and has a **Check for updates** button.
- **Portable build**: does not update itself. Download the newer version to update.
- The first version that includes updating still needs a normal manual install. Updates apply automatically from then on.
- Updates are downloaded from Crate's public GitHub releases. Crate sends no library data.
- If you installed for all users (Program Files), Windows may ask for administrator approval each time an update installs. Choose **Only for me** during setup to avoid that.
