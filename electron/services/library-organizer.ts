import * as fs from 'fs';
import * as path from 'path';

export interface MovedLibraryFile {
  sourcePath: string;
  destinationPath: string;
}

export interface LibraryMoveRequest {
  filePath: string;
  destinationPath: string;
  libraryRoot?: string;
}

function isPathInsideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

/**
 * Validates the untrusted renderer payload while keeping the configured root
 * as the only filesystem trust boundary. `libraryRoot` remains optional for
 * compatibility with older renderers, but when present it must match the
 * main-process setting.
 */
export function validateLibraryMoveRequest(value: unknown, configuredRoot: string): LibraryMoveRequest {
  if (!configuredRoot.trim() || !value || typeof value !== 'object') {
    throw new Error('Invalid library move request.');
  }

  const request = value as Record<string, unknown>;
  if (
    typeof request.filePath !== 'string' ||
    !request.filePath.trim() ||
    typeof request.destinationPath !== 'string' ||
    !request.destinationPath.trim()
  ) {
    throw new Error('Invalid library move request.');
  }

  if (request.libraryRoot !== undefined) {
    if (typeof request.libraryRoot !== 'string' || !request.libraryRoot.trim()) {
      throw new Error('Invalid library move request.');
    }
    if (!samePath(request.libraryRoot, configuredRoot)) {
      throw new Error('Library root does not match the configured library root.');
    }
  }

  return {
    filePath: request.filePath,
    destinationPath: request.destinationPath,
    libraryRoot: configuredRoot,
  };
}

function isPathWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

async function rejectLinkComponents(targetPath: string, rootPath: string, label: string): Promise<void> {
  const relative = path.relative(rootPath, targetPath);
  const components = relative.split(path.sep).filter(Boolean);
  let currentPath = rootPath;

  for (const component of components) {
    currentPath = path.join(currentPath, component);
    try {
      const stats = await fs.promises.lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error(`${label} path contains a symbolic link or junction: ${currentPath}`);
      }
    } catch (error: any) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
  }
}

async function realpathOfExistingAncestor(targetPath: string): Promise<string> {
  let currentPath = targetPath;

  while (true) {
    try {
      return await fs.promises.realpath(currentPath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) throw error;
      currentPath = parentPath;
    }
  }
}

/**
 * Moves one managed-library audio file into its metadata-derived destination.
 *
 * Both paths must remain below the selected library root. The destination is
 * checked before moving so an existing file is never silently overwritten.
 */
export async function moveLibraryFile(
  sourcePath: string,
  destinationPath: string,
  libraryRoot: string
): Promise<MovedLibraryFile> {
  const resolvedRoot = path.resolve(libraryRoot);
  const resolvedSource = path.resolve(sourcePath);
  const resolvedDestination = path.resolve(destinationPath);

  if (!isPathInsideRoot(resolvedSource, resolvedRoot)) {
    throw new Error('Source file is outside the managed library root.');
  }
  if (!isPathInsideRoot(resolvedDestination, resolvedRoot)) {
    throw new Error('Destination file is outside the managed library root.');
  }

  if (samePath(resolvedSource, resolvedDestination)) {
    return {
      sourcePath: resolvedSource,
      destinationPath: resolvedDestination,
    };
  }

  const realRoot = await fs.promises.realpath(resolvedRoot);
  await rejectLinkComponents(resolvedSource, resolvedRoot, 'Source');
  await rejectLinkComponents(resolvedDestination, resolvedRoot, 'Destination');

  const realSource = await fs.promises.realpath(resolvedSource);
  if (!isPathWithinRoot(realSource, realRoot)) {
    throw new Error('Source file resolves outside the managed library root.');
  }

  const existingDestinationParent = await realpathOfExistingAncestor(path.dirname(resolvedDestination));
  if (!isPathWithinRoot(existingDestinationParent, realRoot)) {
    throw new Error('Destination parent resolves outside the managed library root.');
  }

  let sourceStats: fs.Stats;
  try {
    sourceStats = await fs.promises.stat(resolvedSource);
  } catch {
    throw new Error('Source file does not exist: ' + resolvedSource);
  }
  if (!sourceStats.isFile()) {
    throw new Error('Source path is not a file: ' + resolvedSource);
  }

  try {
    await fs.promises.access(resolvedDestination, fs.constants.F_OK);
    throw new Error('Destination already exists: ' + resolvedDestination);
  } catch (err: any) {
    if (err?.message?.startsWith('Destination already exists:')) {
      throw err;
    }
    if (err?.code !== 'ENOENT') {
      throw new Error('Cannot inspect destination: ' + resolvedDestination);
    }
  }

  await fs.promises.mkdir(path.dirname(resolvedDestination), { recursive: true });

  // Re-check after creating missing folders so a link introduced or followed
  // during the operation cannot redirect the final rename outside the root.
  await rejectLinkComponents(path.dirname(resolvedDestination), resolvedRoot, 'Destination');
  const realDestinationParent = await fs.promises.realpath(path.dirname(resolvedDestination));
  if (!isPathWithinRoot(realDestinationParent, realRoot)) {
    throw new Error('Destination parent resolves outside the managed library root.');
  }

  try {
    await fs.promises.rename(resolvedSource, resolvedDestination);
  } catch (err: any) {
    if (err?.code === 'EEXIST' || err?.code === 'ENOTEMPTY') {
      throw new Error('Destination already exists: ' + resolvedDestination);
    }
    throw new Error('Failed to move file to ' + resolvedDestination + ': ' + (err?.message || err));
  }

  return {
    sourcePath: resolvedSource,
    destinationPath: resolvedDestination,
  };
}
