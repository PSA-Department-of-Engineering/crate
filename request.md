# Customer request

The verbatim ask that enters the Scope phase (REF-Delivery section 2); ground truth for what was asked.

---

I want a Windows desktop application for managing my personal music library - browsing and sorting it, fixing its metadata, organizing the files on disk, building playlists, and playing music.

It has to be a desktop app rather than a web app. It works directly against my music files on local disk and against removable drives, and a browser cannot reach either.

The library. My music lives in folders on local disk, mostly MP3 with some albums in FLAC. The app reads that library creating a new folder for it and taking ownership over it which gives me one place to browse and sort it - by artist, album, album artist, year, genre, track number, duration - with search across the same fields.

Metadata. I want to view and edit the tags on my files and have the app write them back into the files themselves: ID3 for MP3 and Vorbis comments for FLAC, so whatever I fix is fixed everywhere and not only in this app's own database. I need to edit a single track and to edit a whole selection at once, and to manage embedded cover art. Everything is local: the app never looks anything up online and never sends anything anywhere.

Folder structure and naming - this is the important one. The app owns the folder layout and file naming of the library, and the pattern is ours to define in the code. The folder and filename pattern to match exactly what my car head unit expects, so that what I see in the app, what is on disk, and what the car shows me are all the same thing and it is 100% compatible. So the pattern can be fixed and if we need adjustments to it we resolve with further tickets but the app must apply it consistently across the whole library.
To begin with you can verify locally on C:\Users\carter\Music for the current structure which is updated with what i currently have on the car (95% works)

Playback. I want to actually play music in the app - a proper player with a queue, play/pause/skip/seek, shuffle and repeat, and control over which audio output it uses. it should be small on the library pages but have its own viewer page like a regular windows media player but we should also be able to undock this, so i can have the player on the second screen playing music and the library on the main one while im organizing

Playlists. I build playlists in the app, and they get written into the library as .m3u files with relative paths so my car lists them next to the folders. Whatever encoding and line endings car firmware expects is what they should be written as.

Getting it to the car. The library lives on my PC in the app and the app itself copies/syncs it out to the USB drive or SD card the car reads, in the same folder structure and naming. It should handle a subset as well as the whole thing - a few playlists, some albums - and be sensible about repeat runs: know what is already on the device, copy only what changed, and tell me what is stale there so I can clear it. No conversion is needed; my car plays FLAC as well as MP3, so everything copies through as-is.

How it ships. Windows only for now. Follow the same shape as foundry-terminal: one app, where the build served on the Foundry hostname is the same renderer running without its desktop bridge, showing an honest empty state that says it needs the desktop app and fakes nothing - not a docs site standing in for the product. The real thing is a portable build attached to the repository release with a checksum file beside it, unsigned and with no auto-updater, and an install page that explains the Windows unrecognised-app warning and how to verify the download.

for the design lets go with simple pale/nude colors, with a type of emerald as the brand color, it should be a bit rounded for modernity sake
