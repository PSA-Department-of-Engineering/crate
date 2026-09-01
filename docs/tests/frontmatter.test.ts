import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { expect, test as viTest } from 'vitest';

export function intent(claimId: string | string[], name: string, fn: () => void | Promise<void>) {
  const ids = Array.isArray(claimId) ? claimId.join(', ') : claimId;
  return viTest(`[${ids}] - ${name}`, fn);
}

const DOCS_DIR = join(process.cwd(), 'docs', 'src', 'content', 'docs');
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;

function pages(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return pages(full);
        return ['.md', '.mdx'].includes(extname(full)) ? [full] : [];
    });
}

intent('INT-STARLIGHT-001', 'every doc page has a non-empty title', () => {
    const docsPath = existsSync(DOCS_DIR) ? DOCS_DIR : join(process.cwd(), 'src', 'content', 'docs');
    const found = pages(docsPath);
    expect(found.length).toBeGreaterThan(0);
    for (const page of found) {
        const match = FRONTMATTER_RE.exec(readFileSync(page, 'utf8'));
        const where = relative(docsPath, page);
        expect(match, `${where}: no frontmatter block`).not.toBeNull();
        expect(match![1], `${where}: frontmatter carries no title:`).toMatch(/^title:\s*\S+/m);
    }
});
