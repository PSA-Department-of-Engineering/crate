import { describe, expect, it } from 'vitest';
import { intent } from './intent-helper';
import * as fs from 'fs';
import * as path from 'path';

describe('Distribution Contract & Visual Theme Tokens', () => {
  intent('INT-DIST-001', 'Hosted web build displays honest prerequisite state and installation guidance', async () => {
    // Contract: Web portal renders honest prerequisite copy and desktop download paths
    const installDoc = await fs.promises.readFile(path.join(process.cwd(), 'docs/install.md'), 'utf-8');
    expect(installDoc).toContain('SmartScreen');
    expect(installDoc).toContain('SHA256');
    expect(installDoc).toContain('Crate-Portable-1.0.0.exe');
  });

  intent('INT-DIST-002', 'Packaging contract produces a portable executable and an NSIS installer', async () => {
    // Contract: electron-builder emits BOTH a portable exe and an NSIS setup
    // installer, and the installer is non-oneClick with a user-chosen directory
    const builderYaml = await fs.promises.readFile(path.join(process.cwd(), 'electron-builder.yml'), 'utf-8');
    expect(builderYaml).toContain('target: portable');
    expect(builderYaml).toContain('target: nsis');
    expect(builderYaml).toContain('oneClick: false');
    expect(builderYaml).toContain('allowToChangeInstallationDirectory: true');
    expect(builderYaml).toContain('artifactName: Crate-Setup-${version}.${ext}');
    expect(builderYaml).toContain('artifactName: Crate-Portable-${version}.${ext}');
  });

  intent('INT-DIST-003', "Packaging embeds this repository's releases as the update feed and CI uploads the Setup installer, blockmap and latest.yml to each release", async () => {
    const pkgJson = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'));
    // electron-updater ships inside the app, so it must be a runtime dependency
    expect(pkgJson.dependencies['electron-updater']).toBeDefined();
    expect(pkgJson.devDependencies?.['electron-updater']).toBeUndefined();

    // The feed is this repository's own releases (which requires it to be
    // public), so there is no second repository and no extra token.
    const builderYaml = await fs.promises.readFile(path.join(process.cwd(), 'electron-builder.yml'), 'utf-8');
    expect(builderYaml).toContain('publish:');
    expect(builderYaml).toContain('provider: github');
    expect(builderYaml).toMatch(/^\s+repo: crate\s*$/m);

    const workflow = await fs.promises.readFile(path.join(process.cwd(), '.github/workflows/build.yml'), 'utf-8');
    expect(workflow).not.toContain('crate-releases');
    expect(workflow).toContain('release/*.exe.blockmap');
    expect(workflow).toContain('release/latest.yml');
    // latest.yml goes up last, after the installer and blockmap it points at, so
    // no client sees a version whose installer is still uploading.
    expect(workflow.indexOf('release/latest.yml')).toBeGreaterThan(workflow.indexOf('release/*.exe.blockmap'));
  });

  intent('INT-UI-001', 'User interface adheres to locked visual identity tokens and Nunito typography', async () => {
    // Invariant: Visual tokens match locked visual identity in .delivery/design.md and docs/brand.md
    const indexCss = await fs.promises.readFile(path.join(process.cwd(), 'src/index.css'), 'utf-8');

    expect(indexCss).toContain('--primary: 160 84% 39%');
    expect(indexCss).toContain('--background: 40 33% 97%');
    expect(indexCss).toContain('--popover: 40 30% 98%');
    expect(indexCss).toContain('--radius: 0.75rem');
    expect(indexCss).toContain("'Nunito'");
  });

  it('Header and WebFallbackView components render dynamic version from package.json without hardcoded version strings', async () => {
    const headerSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf-8');
    expect(headerSource).toContain("import { version as appVersion } from '../../package.json'");
    expect(headerSource).toContain('v{appVersion}');
    expect(headerSource).not.toMatch(/v1\.0\.0/);

    const fallbackSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/WebFallbackView.tsx'), 'utf-8');
    expect(fallbackSource).toContain("import { version as appVersion } from '../../package.json'");
    expect(fallbackSource).toContain('v{appVersion}');
    expect(fallbackSource).not.toMatch(/v1\.0\.0/);
  });

  it('Brand logo SVG and UI header feature the custom vinyl record crate mark', async () => {
    const logoSvg = await fs.promises.readFile(path.join(process.cwd(), 'docs/logo.svg'), 'utf-8');
    expect(logoSvg).toContain('aria-label="Crate"');
    expect(logoSvg).toContain('fill="hsl(160 84% 39%)"');
    expect(logoSvg).not.toMatch(/>C<\/text>/);

    const brandDoc = await fs.promises.readFile(path.join(process.cwd(), 'docs/brand.md'), 'utf-8');
    expect(brandDoc).toContain('vinyl record crate motif');

    const headerSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf-8');
    expect(headerSource).toContain('BrandLogoMark');
  });

  it('Desktop application bundles multi-resolution Windows icons and sets taskbar app ID', async () => {
    // Assert icon asset files exist
    expect(fs.existsSync(path.join(process.cwd(), 'public/icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'public/icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'build/icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'build/icon.png'))).toBe(true);

    // Assert main process configuration
    const mainSource = await fs.promises.readFile(path.join(process.cwd(), 'electron/main.ts'), 'utf-8');
    expect(mainSource).toContain('getAppIcon()');
    expect(mainSource).toContain('setAppUserModelId');
    expect(mainSource).toContain('icon: getAppIcon()');

    // Assert electron-builder packaging config
    const builderYaml = await fs.promises.readFile(path.join(process.cwd(), 'electron-builder.yml'), 'utf-8');
    expect(builderYaml).toContain('icon: build/icon.ico');
  });

  it('Header action toolbar includes Undock, Fix, Folder, Settings buttons and a clean title bar', async () => {
    const headerSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf-8');
    
    // Assert title bar does not display filesystem path badge
    expect(headerSource).not.toContain('{libraryPath && (');
    
    // Assert toolbar action buttons are present with distinct handlers
    expect(headerSource).toContain('onUndockPlayer');
    expect(headerSource).toContain('onRescan');
    expect(headerSource).toContain('onRevealFolder');
    expect(headerSource).toContain('onOpenSettings');
    expect(headerSource).toContain('title="Undock Mini Player to Floating Window"');
    expect(headerSource).toContain('title="Fix & Rescan Library"');
    expect(headerSource).toContain('title="Open Music Folder in File Explorer"');
    expect(headerSource).toContain('title="Library & App Settings"');
  });

  it('audio sink menus use the active theme surface instead of hard-coded glass styling', async () => {
    const indexCss = await fs.promises.readFile(path.join(process.cwd(), 'src/index.css'), 'utf-8');
    const miniPlayerSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/MiniPlayer.tsx'), 'utf-8');
    expect(miniPlayerSource).toContain('isSinkMenuOpen');
    expect(miniPlayerSource).toContain('theme-popover');
    expect(miniPlayerSource).toContain('bg-popover');
    expect(miniPlayerSource).toContain('Audio Output Devices');
    expect(miniPlayerSource).not.toContain('backdrop-blur-md');
    expect(miniPlayerSource).not.toContain('<select');

    const fullPlayerSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/FullPlayer.tsx'), 'utf-8');
    expect(fullPlayerSource).toContain('isSinkMenuOpen');
    expect(fullPlayerSource).toContain('theme-popover');
    expect(fullPlayerSource).toContain('bg-popover');
    expect(fullPlayerSource).not.toContain('<select');

    expect(indexCss).toContain("background-color: hsl(var(--popover));");
    expect(indexCss).toContain(":root[data-theme='glass'] .theme-popover");
  });

  it('Library components render a unified single header bar containing breadcrumbs and view mode toggle', async () => {
    const libraryViewSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/LibraryView.tsx'), 'utf-8');
    expect(libraryViewSource).not.toContain('Library View:');

    const mosaicSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/LibraryMosaic.tsx'), 'utf-8');
    expect(mosaicSource).toContain('LayoutGrid');
    expect(mosaicSource).toContain('Artists');
    expect(mosaicSource).toContain('onSetViewMode');

    const tableSource = await fs.promises.readFile(path.join(process.cwd(), 'src/components/LibraryTable.tsx'), 'utf-8');
    expect(tableSource).toContain('LayoutGrid');
    expect(tableSource).toContain('onSetViewMode');
  });
});
