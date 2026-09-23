/**
 * "Is this module the one that was run?" — correctly, on this host.
 *
 * WORTH ITS OWN FILE. The idiom everyone writes,
 *
 *     if (import.meta.url === `file://${process.argv[1]}`)
 *
 * is false for every path on this machine and fails SILENTLY: the tool runs, exits 0, prints
 * nothing and writes nothing, and looks exactly like a tool whose work was already done. The
 * project root is `E:\QANDEEL\QANDEEL PROJECT`, so the two strings differ three ways at once —
 * backslashes, the space that `import.meta.url` percent-encodes as `%20`, and the third slash
 * a file URL carries before a Windows drive letter.
 *
 * `pathToFileURL` produces all three the same way Node produced `import.meta.url`, so the
 * comparison is between two URLs rather than between a URL and a guess at one.
 */
import { pathToFileURL } from 'node:url';

export const isMain = (metaUrl) => (
  process.argv[1] ? metaUrl === pathToFileURL(process.argv[1]).href : false
);
