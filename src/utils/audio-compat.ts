import { Track } from '../models/types';

/**
 * Car head-unit audio compatibility.
 *
 * Conversion belongs to sync alone: an incompatible WAV is encoded to 16-bit
 * FLAC on its way to the drive and the master stays on the PC untouched. This
 * predicate decides which tracks take that path.
 */

/**
 * Highest PCM bit depth automotive head units decode reliably. BMW iDrive,
 * Audi MMI, Ford SYNC and VW MIB all handle 16- and 24-bit integer PCM; none
 * of them decode 32-bit float.
 */
export const MAX_CAR_BIT_DEPTH = 24;

/**
 * True when a WAV track exceeds what car head units can decode.
 *
 * Note on `codec`: music-metadata derives it from the WAV `wFormatTag`, and
 * most encoders (ffmpeg included) write WAVE_FORMAT_EXTENSIBLE (0xFFFE) rather
 * than the bare IEEE_FLOAT tag (0x0003) — which music-metadata reports as
 * `non-PCM (65534)` because 0xFFFE is absent from its WaveFormat enum. So the
 * `IEEE_FLOAT` check catches only the minority of files that use the bare tag;
 * `bitsPerSample` is what actually carries this in practice. Keep both.
 */
export function isCarIncompatibleWav(track: Track): boolean {
    if (track.format !== 'wav') {
        return false;
    }

    if (track.codec === 'IEEE_FLOAT') {
        return true;
    }

    return track.bitsPerSample !== undefined && track.bitsPerSample > MAX_CAR_BIT_DEPTH;
}

/** Sibling `.flac` path for a `.wav`, preserving the original separator style. */
export function getFlacSiblingPath(wavPath: string): string {
    return wavPath.replace(/\.wav$/i, '.flac');
}

/**
 * Human-readable description of why a WAV is incompatible, for the violation
 * the user reads before approving the conversion. Only claims "float" when the
 * codec tag actually says so — an extensible-format WAV reports `non-PCM
 * (65534)` whether its samples are float or 32-bit integer, and guessing wrong
 * in the confirmation copy is worse than saying less.
 */
export function describeWavIncompatibility(track: Track): string {
    const depth = track.bitsPerSample ? `${track.bitsPerSample}-bit` : 'high bit depth';

    return track.codec === 'IEEE_FLOAT' ? `${depth} float` : depth;
}
