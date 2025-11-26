/**
 * Config command for Weather Oracle CLI.
 * Manages configuration settings with git/npm-style interface.
 */

import chalk from "chalk";
import { unlink } from "node:fs/promises";
import type { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  configFileExists,
  CONFIG_KEYS,
  getValidKeys,
  isValidKey,
  getConfigValue,
  getDefaultValue,
  setConfigValue,
  unsetConfigValue,
  parseConfigValue,
  flattenConfig,
  formatConfigValue,
  type AppConfig,
  type ConfigKey,
} from "@weather-oracle/core";

/**
 * Load the user's config file (just the file, not merged with defaults)
 */
async function loadUserConfigFile(): Promise<Partial<AppConfig>> {
  const filePath = getConfigPath();
  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

/**
 * Config show (default) - display all configuration
 */
async function configShow(): Promise<void> {
  const config = await loadConfig();
  const fileConfig = await loadUserConfigFile();
  const entries = flattenConfig(config, fileConfig);

  console.log("");
  console.log(chalk.bold("Weather Oracle Configuration"));
  console.log(chalk.dim("─".repeat(50)));
  console.log("");

  // Group by section
  const sections: Map<string, Array<{ key: ConfigKey; value: unknown; source: string }>> = new Map();

  for (const entry of entries) {
    const [section] = entry.key.split(".");
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(entry);
  }

  for (const [section, sectionEntries] of sections) {
    console.log(chalk.cyan.bold(`[${section}]`));
    for (const { key, value, source } of sectionEntries) {
      const formattedValue = formatConfigValue(value);
      const sourceLabel = source === "file" ? chalk.green("(config file)") : chalk.dim("(default)");
      console.log(`  ${key} = ${chalk.white(formattedValue)} ${sourceLabel}`);
    }
    console.log("");
  }

  console.log(chalk.dim(`Config file: ${getConfigPath()}`));
}

/**
 * Config get <key> - get a single configuration value
 */
async function configGet(key: string): Promise<void> {
  if (!isValidKey(key)) {
    console.error(chalk.red(`Unknown configuration key: ${key}`));
    console.error(chalk.dim(`Valid keys: ${getValidKeys().join(", ")}`));
    process.exit(1);
  }

  const config = await loadConfig();
  const value = getConfigValue(config, key);
  console.log(formatConfigValue(value));
}

/**
 * Config set <key> <value> - set a configuration value
 */
async function configSet(key: string, value: string): Promise<void> {
  if (!isValidKey(key)) {
    console.error(chalk.red(`Unknown configuration key: ${key}`));
    console.error(chalk.dim(`Valid keys: ${getValidKeys().join(", ")}`));
    process.exit(1);
  }

  // Parse and validate the value
  let parsedValue: unknown;
  try {
    parsedValue = parseConfigValue(key, value);
  } catch (error) {
    console.error(chalk.red(`Invalid value for ${key}: ${(error as Error).message}`));
    process.exit(1);
  }

  // Load existing config file and update
  const fileConfig = await loadUserConfigFile();
  const updatedConfig = setConfigValue(fileConfig, key, parsedValue);

  // Save to file
  await saveConfig(updatedConfig);

  console.log(chalk.green(`Set ${key} = ${formatConfigValue(parsedValue)}`));
}

/**
 * Config unset <key> - remove a configuration value (revert to default)
 */
async function configUnset(key: string): Promise<void> {
  if (!isValidKey(key)) {
    console.error(chalk.red(`Unknown configuration key: ${key}`));
    console.error(chalk.dim(`Valid keys: ${getValidKeys().join(", ")}`));
    process.exit(1);
  }

  // Load existing config file and remove the key
  const fileConfig = await loadUserConfigFile();
  const updatedConfig = unsetConfigValue(fileConfig, key);

  // Save to file
  await saveConfig(updatedConfig);

  const defaultValue = getDefaultValue(key);
  console.log(chalk.green(`Unset ${key} (now using default: ${formatConfigValue(defaultValue)})`));
}

/**
 * Config path - show the config file path
 */
function configPath(): void {
  console.log(getConfigPath());
}

/**
 * Config reset - reset configuration to defaults
 */
async function configReset(force: boolean): Promise<void> {
  if (!force) {
    console.error(chalk.yellow("This will delete your config file and reset all settings to defaults."));
    console.error(chalk.yellow("Use --force to confirm."));
    process.exit(1);
  }

  const filePath = getConfigPath();
  const exists = await configFileExists();

  if (!exists) {
    console.log(chalk.dim("No config file exists. Already using defaults."));
    return;
  }

  await unlink(filePath);
  console.log(chalk.green("Configuration reset to defaults."));
}

/**
 * Config list-keys - list all valid configuration keys
 */
function configListKeys(): void {
  console.log("");
  console.log(chalk.bold("Valid Configuration Keys"));
  console.log(chalk.dim("─".repeat(60)));
  console.log("");

  for (const key of getValidKeys()) {
    const keyInfo = CONFIG_KEYS[key];
    const defaultValue = getDefaultValue(key);

    console.log(chalk.cyan(key));
    console.log(`  ${chalk.dim("Description:")} ${keyInfo.description}`);
    console.log(`  ${chalk.dim("Type:")} ${keyInfo.type}`);
    if ("values" in keyInfo) {
      console.log(`  ${chalk.dim("Values:")} ${keyInfo.values.join(", ")}`);
    }
    if ("min" in keyInfo || "max" in keyInfo) {
      const range = [];
      if ("min" in keyInfo) range.push(`min: ${keyInfo.min}`);
      if ("max" in keyInfo) range.push(`max: ${keyInfo.max}`);
      console.log(`  ${chalk.dim("Range:")} ${range.join(", ")}`);
    }
    console.log(`  ${chalk.dim("Default:")} ${formatConfigValue(defaultValue)}`);
    console.log("");
  }
}

/**
 * Register the config command with the CLI program
 */
export function registerConfigCommand(program: Command): void {
  // Remove the placeholder config command
  const existingCommandIndex = (program.commands as Command[]).findIndex(
    (cmd) => cmd.name() === "config"
  );
  if (existingCommandIndex !== -1) {
    (program.commands as Command[]).splice(existingCommandIndex, 1);
  }

  const configCmd = program
    .command("config [key] [value]")
    .description("Manage Weather Oracle configuration")
    .option("--list-keys", "List all valid configuration keys")
    .action(async (key?: string, value?: string, options?: { listKeys?: boolean }) => {
      // Handle --list-keys option
      if (options?.listKeys) {
        configListKeys();
        return;
      }

      // No arguments - show all config
      if (!key) {
        await configShow();
        return;
      }

      // One argument - get value
      if (!value) {
        await configGet(key);
        return;
      }

      // Two arguments - set value
      await configSet(key, value);
    });

  // Subcommand: config get <key>
  configCmd
    .command("get <key>")
    .description("Get a configuration value")
    .action(async (key: string) => {
      await configGet(key);
    });

  // Subcommand: config set <key> <value>
  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action(async (key: string, value: string) => {
      await configSet(key, value);
    });

  // Subcommand: config unset <key>
  configCmd
    .command("unset <key>")
    .description("Remove a configuration value (revert to default)")
    .action(async (key: string) => {
      await configUnset(key);
    });

  // Subcommand: config path
  configCmd
    .command("path")
    .description("Show the configuration file path")
    .action(() => {
      configPath();
    });

  // Subcommand: config reset
  configCmd
    .command("reset")
    .description("Reset configuration to defaults")
    .option("--force", "Confirm reset without prompting")
    .action(async (options: { force?: boolean }) => {
      await configReset(options.force ?? false);
    });

  // Subcommand: config list-keys
  configCmd
    .command("list-keys")
    .description("List all valid configuration keys with descriptions")
    .action(() => {
      configListKeys();
    });
}
