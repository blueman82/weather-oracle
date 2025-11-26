#!/usr/bin/env bun
/**
 * @weather-oracle/cli
 * Command-line interface for Weather Oracle - Multi-model weather forecast aggregator
 */

import { createProgram, extractGlobalOptions, loadConfigWithOverrides, chalk } from "./program";
import type { GlobalOptions } from "./program";

// Re-export program utilities for potential external use
export { createProgram, extractGlobalOptions, loadConfigWithOverrides, chalk };
export type { GlobalOptions };

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else {
      console.error(chalk.red("An unexpected error occurred"));
    }
    process.exit(1);
  }
}

// Run the CLI
main().catch((error: unknown) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
