/**
 * Configuration-specific error classes.
 */

import { WeatherOracleError, ErrorCode, type ErrorDebugInfo } from "./base";

/**
 * Error thrown when configuration operations fail.
 */
export class ConfigError extends WeatherOracleError {
  readonly configKey?: string;
  readonly filePath?: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    options?: {
      configKey?: string;
      filePath?: string;
      debugInfo?: Omit<ErrorDebugInfo, "timestamp">;
    }
  ) {
    super(code, message, userMessage, options?.debugInfo);
    this.name = "ConfigError";
    this.configKey = options?.configKey;
    this.filePath = options?.filePath;
  }

  /**
   * Create an invalid configuration error
   */
  static invalid(
    configKey: string,
    reason: string,
    filePath?: string
  ): ConfigError {
    return new ConfigError(
      ErrorCode.CONFIG_INVALID,
      `Invalid configuration for "${configKey}": ${reason}`,
      `Invalid configuration: ${reason}. Please check your settings.`,
      {
        configKey,
        filePath,
        debugInfo: { configKey, reason, filePath },
      }
    );
  }

  /**
   * Create a missing configuration error
   */
  static missing(
    configKey: string,
    description?: string
  ): ConfigError {
    const desc = description ? ` (${description})` : "";
    return new ConfigError(
      ErrorCode.CONFIG_MISSING,
      `Missing required configuration: "${configKey}"${desc}`,
      `Missing configuration: "${configKey}". Please configure this setting.`,
      {
        configKey,
        debugInfo: { configKey, description },
      }
    );
  }

  /**
   * Create a parse error for configuration files
   */
  static parseError(
    filePath: string,
    cause?: Error
  ): ConfigError {
    return new ConfigError(
      ErrorCode.CONFIG_PARSE_ERROR,
      `Failed to parse configuration file "${filePath}": ${cause?.message ?? "Unknown error"}`,
      `Could not read configuration file. Please check the file format.`,
      {
        filePath,
        debugInfo: {
          filePath,
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }

  /**
   * Create an error for missing environment variable
   */
  static missingEnvVar(
    varName: string,
    purpose?: string
  ): ConfigError {
    const purposeText = purpose ? ` for ${purpose}` : "";
    return new ConfigError(
      ErrorCode.CONFIG_MISSING,
      `Missing environment variable: ${varName}${purposeText}`,
      `Missing environment variable: ${varName}. Please set this in your environment.`,
      {
        configKey: varName,
        debugInfo: { envVar: varName, purpose },
      }
    );
  }
}
