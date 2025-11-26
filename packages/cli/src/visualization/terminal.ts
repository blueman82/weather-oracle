/**
 * Terminal Capability Detection
 *
 * Detects terminal color support and animation capabilities using
 * a hierarchical detection system based on environment variables.
 */

/**
 * Render tier levels from highest to lowest capability.
 * - RICH: Full 24-bit truecolor with animations (interactive TTY)
 * - FULL: Full 24-bit truecolor without animations (non-interactive/piped)
 * - STANDARD: 256 colors (xterm-256color terminals)
 * - COMPAT: Basic 16 ANSI colors (basic TTY)
 * - PLAIN: No color support (NO_COLOR or dumb terminals)
 */
export enum RenderTier {
  RICH = "rich",
  FULL = "full",
  STANDARD = "standard",
  COMPAT = "compat",
  PLAIN = "plain",
}

let cachedColorSupport: RenderTier | null = null;
let cachedAnimationSupport: boolean | null = null;

/**
 * Checks if running in a CI environment.
 * CI environments typically don't support animations.
 */
function isCI(): boolean {
  return (
    process.env.CI !== undefined ||
    process.env.CONTINUOUS_INTEGRATION !== undefined ||
    process.env.GITHUB_ACTIONS !== undefined ||
    process.env.GITLAB_CI !== undefined ||
    process.env.CIRCLECI !== undefined ||
    process.env.TRAVIS !== undefined ||
    process.env.JENKINS_URL !== undefined ||
    process.env.BUILDKITE !== undefined ||
    process.env.TEAMCITY_VERSION !== undefined ||
    process.env.TF_BUILD !== undefined
  );
}

/**
 * Checks if stdout is an interactive TTY.
 */
function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Parses FORCE_COLOR environment variable.
 * Returns the color level or null if not set/invalid.
 */
function parseForcedColorLevel(): RenderTier | null {
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor === undefined) {
    return null;
  }

  // FORCE_COLOR can be: "", "0", "1", "2", "3", "true", "false"
  if (forceColor === "0" || forceColor === "false") {
    return RenderTier.PLAIN;
  }
  if (forceColor === "1") {
    return RenderTier.COMPAT;
  }
  if (forceColor === "2") {
    return RenderTier.STANDARD;
  }
  if (forceColor === "3" || forceColor === "" || forceColor === "true") {
    return isTTY() ? RenderTier.RICH : RenderTier.FULL;
  }

  return null;
}

/**
 * Detects the color support level of the current terminal environment.
 *
 * Detection priority:
 * 1. NO_COLOR (standard) → PLAIN
 * 2. FORCE_COLOR → respect level
 * 3. COLORTERM=truecolor → RICH/FULL based on TTY
 * 4. TERM contains 256 → STANDARD
 * 5. isTTY → COMPAT
 * 6. Default → PLAIN
 *
 * Results are cached since terminal capabilities don't change during execution.
 */
export function detectColorSupport(): RenderTier {
  if (cachedColorSupport !== null) {
    return cachedColorSupport;
  }

  // 1. NO_COLOR takes absolute precedence per https://no-color.org/
  if (process.env.NO_COLOR !== undefined) {
    cachedColorSupport = RenderTier.PLAIN;
    return cachedColorSupport;
  }

  // 2. FORCE_COLOR overrides automatic detection
  const forcedLevel = parseForcedColorLevel();
  if (forcedLevel !== null) {
    cachedColorSupport = forcedLevel;
    return cachedColorSupport;
  }

  // Check for dumb terminal
  const term = process.env.TERM?.toLowerCase() ?? "";
  if (term === "dumb") {
    cachedColorSupport = RenderTier.PLAIN;
    return cachedColorSupport;
  }

  // 3. COLORTERM=truecolor/24bit indicates full color support
  const colorTerm = process.env.COLORTERM?.toLowerCase() ?? "";
  if (colorTerm === "truecolor" || colorTerm === "24bit") {
    cachedColorSupport = isTTY() ? RenderTier.RICH : RenderTier.FULL;
    return cachedColorSupport;
  }

  // 4. TERM containing 256 indicates 256-color support
  if (term.includes("256color") || term.includes("256-color")) {
    cachedColorSupport = RenderTier.STANDARD;
    return cachedColorSupport;
  }

  // 5. If we have a TTY, assume basic color support
  if (isTTY()) {
    cachedColorSupport = RenderTier.COMPAT;
    return cachedColorSupport;
  }

  // 6. Default to no color support
  cachedColorSupport = RenderTier.PLAIN;
  return cachedColorSupport;
}

/**
 * Determines if the terminal supports animations.
 *
 * Animations are supported when:
 * - Running in an interactive TTY
 * - Not in a CI environment
 * - Color support is RICH tier
 *
 * Results are cached since capabilities don't change during execution.
 */
export function supportsAnimation(): boolean {
  if (cachedAnimationSupport !== null) {
    return cachedAnimationSupport;
  }

  const colorSupport = detectColorSupport();
  cachedAnimationSupport =
    isTTY() && !isCI() && colorSupport === RenderTier.RICH;

  return cachedAnimationSupport;
}

/**
 * Clears the cached detection results.
 * Primarily useful for testing.
 */
export function clearCache(): void {
  cachedColorSupport = null;
  cachedAnimationSupport = null;
}
