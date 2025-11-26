/**
 * API response helpers for Weather Oracle web routes.
 * Provides consistent success/error response patterns.
 */

import { NextResponse } from "next/server";
import type { ModelName } from "@weather-oracle/core";

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    fetchedAt: string;
    models?: ModelName[];
    cached?: boolean;
    duration?: number;
  };
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  meta: Omit<ApiSuccessResponse<T>["meta"], "fetchedAt"> & {
    fetchedAt?: string | Date;
  } = {}
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      fetchedAt:
        meta.fetchedAt instanceof Date
          ? meta.fetchedAt.toISOString()
          : meta.fetchedAt ?? new Date().toISOString(),
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * Common error responses
 */
export const errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    errorResponse("BAD_REQUEST", message, 400, details),

  notFound: (message: string) => errorResponse("NOT_FOUND", message, 404),

  internalError: (message: string = "An internal error occurred") =>
    errorResponse("INTERNAL_ERROR", message, 500),

  serviceUnavailable: (message: string = "Service temporarily unavailable") =>
    errorResponse("SERVICE_UNAVAILABLE", message, 503),

  rateLimited: (message: string = "Rate limit exceeded") =>
    errorResponse("RATE_LIMIT_EXCEEDED", message, 429),

  missingParameter: (param: string) =>
    errorResponse("MISSING_PARAMETER", `Missing required parameter: ${param}`, 400, {
      parameter: param,
    }),
} as const;

/**
 * CORS headers for API routes
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle OPTIONS request for CORS
 */
export function handleCors(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Add CORS headers to a response
 */
export function withCors<T>(response: NextResponse<T>): NextResponse<T> {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}
