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

  intent('INT-DIST-002', 'Packaging contract produces portable release without auto-updaters', async () => {
    // Contract: Package.json and electron configuration produces portable release without auto-updater
    const pkgJson = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'));
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    expect(allDeps['electron-updater']).toBeUndefined();
    expect(allDeps['update-electron-app']).toBeUndefined();
  });

  intent('INT-UI-001', 'User interface adheres to locked visual identity tokens and Nunito typography', async () => {
    // Invariant: Visual tokens match locked visual identity in .delivery/design.md and docs/brand.md
    const indexCss = await fs.promises.readFile(path.join(process.cwd(), 'src/index.css'), 'utf-8');

    expect(indexCss).toContain('--primary: 160 84% 39%');
    expect(indexCss).toContain('--background: 40 33% 97%');
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
});
