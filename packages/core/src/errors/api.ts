/**
 * API-specific error classes for weather data fetching.
 */

import { WeatherOracleError, ErrorCode, type ErrorDebugInfo } from "./base";
import type { ModelName } from "../types/models";

/**
 * Error thrown when API operations fail.
 */
export class ApiError extends WeatherOracleError {
  readonly statusCode?: number;
  readonly endpoint?: string;
  readonly model?: ModelName;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    options?: {
      statusCode?: number;
      endpoint?: string;
      model?: ModelName;
      debugInfo?: Omit<ErrorDebugInfo, "timestamp">;
    }
  ) {
    super(code, message, userMessage, options?.debugInfo);
    this.name = "ApiError";
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.model = options?.model;
  }

  /**
   * Create a rate limit error
   */
  static rateLimited(
    retryAfterSeconds?: number,
    model?: ModelName
  ): ApiError {
    const retryText = retryAfterSeconds
      ? ` Please try again in ${retryAfterSeconds} seconds.`
      : " Please try again later.";

    return new ApiError(
      ErrorCode.API_RATE_LIMIT,
      `Rate limit exceeded${model ? ` for ${model}` : ""}`,
      `Too many requests.${retryText}`,
      {
        statusCode: 429,
        model,
        debugInfo: { retryAfterSeconds },
      }
    );
  }

  /**
   * Create a timeout error
   */
  static timeout(
    endpoint: string,
    timeoutMs: number,
    model?: ModelName
  ): ApiError {
    return new ApiError(
      ErrorCode.API_TIMEOUT,
      `Request timed out after ${timeoutMs}ms to ${endpoint}`,
      "The request took too long. Please try again.",
      {
        endpoint,
        model,
        debugInfo: { timeoutMs, endpoint },
      }
    );
  }

  /**
   * Create an unavailable service error
   */
  static unavailable(
    model?: ModelName,
    cause?: Error
  ): ApiError {
    const modelText = model ? ` (${model})` : "";
    return new ApiError(
      ErrorCode.API_UNAVAILABLE,
      `Weather service unavailable${modelText}: ${cause?.message ?? "Unknown error"}`,
      `Weather service is temporarily unavailable. Please try again later.`,
      {
        model,
        debugInfo: {
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }

  /**
   * Create an invalid response error
   */
  static invalidResponse(
    endpoint: string,
    reason: string,
    model?: ModelName
  ): ApiError {
    return new ApiError(
      ErrorCode.API_INVALID_RESPONSE,
      `Invalid response from ${endpoint}: ${reason}`,
      "Received invalid data from weather service. Please try again.",
      {
        endpoint,
        model,
        debugInfo: { reason, endpoint },
      }
    );
  }

  /**
   * Create an authentication error
   */
  static authFailed(
    endpoint: string,
    model?: ModelName
  ): ApiError {
    return new ApiError(
      ErrorCode.API_AUTH_FAILED,
      `Authentication failed for ${endpoint}`,
      "API authentication failed. Please check your configuration.",
      {
        statusCode: 401,
        endpoint,
        model,
        debugInfo: { endpoint },
      }
    );
  }

  /**
   * Create an API error from an HTTP response
   */
  static fromResponse(
    statusCode: number,
    statusText: string,
    endpoint: string,
    model?: ModelName
  ): ApiError {
    let code: ErrorCode;
    let userMessage: string;

    switch (statusCode) {
      case 401:
      case 403:
        code = ErrorCode.API_AUTH_FAILED;
        userMessage = "API authentication failed. Please check your configuration.";
        break;
      case 429:
        code = ErrorCode.API_RATE_LIMIT;
        userMessage = "Too many requests. Please try again later.";
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        code = ErrorCode.API_UNAVAILABLE;
        userMessage = "Weather service is temporarily unavailable. Please try again later.";
        break;
      default:
        code = ErrorCode.API_INVALID_RESPONSE;
        userMessage = "Failed to fetch weather data. Please try again.";
    }

    return new ApiError(
      code,
      `HTTP ${statusCode} ${statusText} from ${endpoint}`,
      userMessage,
      {
        statusCode,
        endpoint,
        model,
        debugInfo: { statusCode, statusText, endpoint },
      }
    );
  }
}
