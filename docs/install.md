# Crate - Installation & Windows SmartScreen Guide

## System Requirements

- **Operating System**: Windows 10 (1809+) or Windows 11 (64-bit x86_64)
- **Processor**: Dual-core 1.6 GHz or faster
- **Memory**: 4 GB RAM minimum
- **Disk Space**: ~150 MB for application files + storage for your music collection

## Downloading Crate

1. Visit the Crate web distribution portal at `https://crate.chaos-architect.dev`.
2. Download the latest portable Windows executable: `Crate-Portable-1.0.0.exe` or `Crate-Setup-1.0.0.exe`.
3. Verify the binary checksum using PowerShell:
   ```powershell
   Get-FileHash .\Crate-Portable-1.0.0.exe -Algorithm SHA256
   ```
4. Compare the hash against the published `checksums.txt` on the portal.

## Windows SmartScreen Notice

Because Crate is distributed as an independent open-source release without an expensive EV code-signing certificate, Windows Defender SmartScreen may display an informational dialog on initial launch:

> *"Windows protected your PC: Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

### Steps to Run:
1. Click **"More info"** on the SmartScreen dialog.
2. Verify the publisher is listed as PSA Department of Engineering / Crate.
3. Click the **"Run anyway"** button.

## Updating Crate

- **Setup (installed) build**: updates itself. Crate checks for a newer version shortly after launch and every few hours while it runs, and downloads it in the background. When it is ready, a **Restart to update** banner appears. Choose **Later** and the update installs the next time you quit. **Settings > Updates** shows the current status and has a **Check for updates** button.
- **Portable build**: does not update itself. Download the newer version to update.
- The first version that includes updating still needs a normal manual install. Updates apply automatically from then on.
- Updates are downloaded from the public `crate-releases` repository on GitHub. Crate sends no library data.
- If you installed for all users (Program Files), Windows may ask for administrator approval each time an update installs. Choose **Only for me** during setup to avoid that.

## Preparing Removable USB Drives for Car Head Units

1. Format your USB flash drive or SD card as **FAT32** (or **exFAT** for drives >32 GB if supported by your vehicle).
2. Open Crate and navigate to the **Car Sync** tab.
3. Select your connected USB drive letter from the dropdown.
4. Choose your sync scope (All Library, Playlists, or Specific Albums).
5. Click **"Run Sync"**. Crate will structure your files into `<Artist>/<Album>/<Track#> <Title>.<ext>` and generate relative `.m3u` playlists with CRLF line endings.
