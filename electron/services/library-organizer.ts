import * as fs from 'fs';
import * as path from 'path';

export interface MovedLibraryFile {
  sourcePath: string;
  destinationPath: string;
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
