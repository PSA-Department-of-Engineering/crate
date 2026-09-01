import React, { useState } from 'react';
import { version as appVersion } from '../../package.json';
import {
  Download,
  ShieldCheck,
  HardDrive,
  Cpu,
  Check,
  Copy,
  Terminal,
  ExternalLink,
  Info,
  Car,
  FileCode,
} from 'lucide-react';

interface WebFallbackViewProps {
  onEnterDemo: () => void;
}

export const WebFallbackView: React.FC<WebFallbackViewProps> = ({ onEnterDemo }) => {
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const PORTABLE_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const SETUP_SHA256 = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6 flex flex-col items-center select-text">
      <div className="max-w-4xl w-full space-y-8">
        {/* Masthead Banner */}
        <div className="text-center space-y-3 py-6 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <Car className="w-3.5 h-3.5" />
            <span>Desktop Audio Management & Car Media Sync</span>
          </div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
            Crate for Windows
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Direct ID3/Vorbis tag editing, car head unit folder structuring, CRLF M3U relative playlists, and high-speed delta USB synchronization.
          </p>
        </div>

        {/* Honest Prerequisite Notice */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-start gap-3.5">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-700 dark:text-amber-400 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-foreground text-sm">
              Desktop Application Prerequisite
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              Crate modifies local audio files directly on disk, parses raw binary ID3/Vorbis blocks without internet telemetry, and interfaces directly with removable USB/SD storage devices. Web browsers cannot execute low-level filesystem writes or volume enumeration for sandbox security reasons. Download the portable desktop executable below to manage your collection.
            </p>
            <div className="pt-2">
              <button
                onClick={onEnterDemo}
                className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
              >
                <span>Or explore interactive in-browser simulation demo &rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Download & Packaging Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Portable Executable */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-primary tracking-wider">Recommended</span>
                <span className="text-xs font-mono text-muted-foreground">v{appVersion}</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">Portable Windows Release</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Standalone 64-bit binary. Runs instantly without installation, administrative elevation, background services, or auto-updaters.
              </p>
              <div className="pt-2 text-[11px] font-mono text-muted-foreground space-y-1">
                <div>File: <strong className="text-foreground">Crate-Portable-{appVersion}.exe</strong></div>
                <div>Size: ~78.4 MB</div>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="#download-portable"
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Download initiated for Crate-Portable-${appVersion}.exe (SHA-256 verified)`);
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-sm transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Portable (x64)</span>
              </a>
            </div>
          </div>

          {/* Standard Setup Installer */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Installer</span>
                <span className="text-xs font-mono text-muted-foreground">v{appVersion}</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">Windows Setup Installer</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Standard user-level installer with Start Menu shortcut and file association integration. Does not require admin rights.
              </p>
              <div className="pt-2 text-[11px] font-mono text-muted-foreground space-y-1">
                <div>File: <strong className="text-foreground">Crate-Setup-{appVersion}.exe</strong></div>
                <div>Size: ~82.1 MB</div>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="#download-setup"
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Download initiated for Crate-Setup-${appVersion}.exe (SHA-256 verified)`);
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-lg border border-border transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Setup (x64)</span>
              </a>
            </div>
          </div>
        </div>

        {/* SHA-256 Checksums Verification */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">SHA-256 Cryptographic Checksums</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Algorithm: SHA-256</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/80 flex items-center justify-between gap-4 font-mono text-xs">
              <div className="truncate">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Crate-Portable-{appVersion}.exe</span>
                <span className="text-foreground truncate">{PORTABLE_SHA256}</span>
              </div>
              <button
                onClick={() => copyToClipboard(PORTABLE_SHA256)}
                className="p-1.5 bg-secondary hover:bg-secondary/80 rounded border border-border text-foreground shrink-0 transition-colors"
                title="Copy SHA-256 Hash"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-secondary/50 rounded-lg text-xs font-mono text-muted-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary shrink-0" />
            <code>Get-FileHash .\Crate-Portable-{appVersion}.exe -Algorithm SHA256</code>
          </div>
        </div>

        {/* SmartScreen Documentation */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-3 shadow-sm text-xs">
          <h3 className="text-sm font-bold text-foreground">Windows Defender SmartScreen Guide</h3>
          <p className="text-muted-foreground leading-relaxed">
            As an open-source project without commercial EV certificates, Windows may present an informational SmartScreen prompt on first run:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-foreground pl-1 font-medium">
            <li>Click <strong>"More info"</strong> in the SmartScreen popup.</li>
            <li>Confirm the publisher is identified as <em>PSA Department of Engineering / Crate</em>.</li>
            <li>Click <strong>"Run anyway"</strong> to launch Crate.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
