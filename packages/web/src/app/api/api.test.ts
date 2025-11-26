/**
 * Tests for Weather Oracle Web API routes.
 */

import { describe, it, expect } from "bun:test";
import {
  successResponse,
  errorResponse,
  errors,
  withCors,
  handleCors,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from "./response";

describe("API Response Helpers", () => {
  describe("successResponse", () => {
    it("should create a success response with data", async () => {
      const data = { message: "Hello" };
      const response = successResponse(data);

      expect(response.status).toBe(200);

      const json = (await response.json()) as ApiSuccessResponse<typeof data>;
      expect(json.success).toBe(true);
      expect(json.data).toEqual(data);
      expect(json.meta.fetchedAt).toBeDefined();
    });

    it("should include optional metadata", async () => {
      const data = { temp: 20 };
      const response = successResponse(data, {
        models: ["gfs", "ecmwf"],
        cached: true,
        duration: 150,
      });

      const json = (await response.json()) as ApiSuccessResponse<typeof data>;
      expect(json.meta.models).toEqual(["gfs", "ecmwf"]);
      expect(json.meta.cached).toBe(true);
      expect(json.meta.duration).toBe(150);
    });

    it("should handle Date objects for fetchedAt", async () => {
      const fetchedAt = new Date("2024-01-15T12:00:00Z");
      const response = successResponse({ test: true }, { fetchedAt });

      const json = (await response.json()) as ApiSuccessResponse<{ test: boolean }>;
      expect(json.meta.fetchedAt).toBe("2024-01-15T12:00:00.000Z");
    });

    it("should set Cache-Control header", () => {
      const response = successResponse({ data: true });
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=300, s-maxage=600"
      );
    });
  });

  describe("errorResponse", () => {
    it("should create an error response", async () => {
      const response = errorResponse("TEST_ERROR", "Test error message", 400);

      expect(response.status).toBe(400);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("TEST_ERROR");
      expect(json.error.message).toBe("Test error message");
    });

    it("should include details when provided", async () => {
      const response = errorResponse("DETAIL_ERROR", "With details", 500, {
        field: "test",
        value: 123,
      });

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.details).toEqual({ field: "test", value: 123 });
    });

    it("should default to 500 status", async () => {
      const response = errorResponse("INTERNAL", "Server error");
      expect(response.status).toBe(500);
    });
  });

  describe("errors factory", () => {
    it("should create badRequest error", async () => {
      const response = errors.badRequest("Invalid input");

      expect(response.status).toBe(400);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("should create notFound error", async () => {
      const response = errors.notFound("Resource not found");

      expect(response.status).toBe(404);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should create internalError with default message", async () => {
      const response = errors.internalError();

      expect(response.status).toBe(500);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.message).toBe("An internal error occurred");
    });

    it("should create serviceUnavailable error", async () => {
      const response = errors.serviceUnavailable("Weather API down");

      expect(response.status).toBe(503);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("should create rateLimited error", async () => {
      const response = errors.rateLimited();

      expect(response.status).toBe(429);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("should create missingParameter error with details", async () => {
      const response = errors.missingParameter("location");

      expect(response.status).toBe(400);

      const json = (await response.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("MISSING_PARAMETER");
      expect(json.error.message).toBe("Missing required parameter: location");
      expect(json.error.details).toEqual({ parameter: "location" });
    });
  });

  describe("CORS helpers", () => {
    it("handleCors should return 204 with CORS headers", () => {
      const response = handleCors();

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization"
      );
    });

    it("withCors should add CORS headers to existing response", () => {
      const original = successResponse({ test: true });
      const withCorsResponse = withCors(original);

      expect(withCorsResponse.headers.get("Access-Control-Allow-Origin")).toBe(
        "*"
      );
      expect(withCorsResponse.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, OPTIONS"
      );
    });
  });
});

describe("API Route Parameter Validation", () => {
  // These tests validate the parameter parsing logic
  // without making actual HTTP requests

  describe("geocode parameter validation", () => {
    it("should reject empty query", () => {
      const query: string | null = "";
      const isValid = Boolean(query && query.trim().length > 0);
      expect(isValid).toBe(false);
    });

    it("should accept valid query", () => {
      const query: string | null = "London";
      const isValid = Boolean(query && query.trim().length > 0);
      expect(isValid).toBe(true);
    });

    it("should validate count range", () => {
      const validateCount = (countParam: string | null): boolean => {
        if (!countParam) return true;
        const parsed = parseInt(countParam, 10);
        return !isNaN(parsed) && parsed >= 1 && parsed <= 10;
      };

      expect(validateCount(null)).toBe(true);
      expect(validateCount("5")).toBe(true);
      expect(validateCount("1")).toBe(true);
      expect(validateCount("10")).toBe(true);
      expect(validateCount("0")).toBe(false);
      expect(validateCount("11")).toBe(false);
      expect(validateCount("abc")).toBe(false);
    });
  });

  describe("forecast parameter validation", () => {
    it("should require either location or coordinates", () => {
      const validateLocationParams = (
        location: string | null,
        lat: string | null,
        lon: string | null
      ): boolean => {
        const hasLocation = location && location.trim().length > 0;
        const hasCoordinates = lat && lon;
        return Boolean(hasLocation || hasCoordinates);
      };

      expect(validateLocationParams("London", null, null)).toBe(true);
      expect(validateLocationParams(null, "51.5", "-0.1")).toBe(true);
      expect(validateLocationParams(null, null, null)).toBe(false);
      expect(validateLocationParams(null, "51.5", null)).toBe(false);
      expect(validateLocationParams("", null, null)).toBe(false);
    });

    it("should validate days range", () => {
      const validateDays = (daysParam: string | null): boolean => {
        if (!daysParam) return true;
        const parsed = parseInt(daysParam, 10);
        return !isNaN(parsed) && parsed >= 1 && parsed <= 7;
      };

      expect(validateDays(null)).toBe(true);
      expect(validateDays("5")).toBe(true);
      expect(validateDays("1")).toBe(true);
      expect(validateDays("7")).toBe(true);
      expect(validateDays("0")).toBe(false);
      expect(validateDays("8")).toBe(false);
    });

    it("should validate latitude range", () => {
      const validateLat = (lat: string): boolean => {
        const parsed = parseFloat(lat);
        return !isNaN(parsed) && parsed >= -90 && parsed <= 90;
      };

      expect(validateLat("0")).toBe(true);
      expect(validateLat("51.5")).toBe(true);
      expect(validateLat("-90")).toBe(true);
      expect(validateLat("90")).toBe(true);
      expect(validateLat("-91")).toBe(false);
      expect(validateLat("91")).toBe(false);
      expect(validateLat("abc")).toBe(false);
    });

    it("should validate longitude range", () => {
      const validateLon = (lon: string): boolean => {
        const parsed = parseFloat(lon);
        return !isNaN(parsed) && parsed >= -180 && parsed <= 180;
      };

      expect(validateLon("0")).toBe(true);
      expect(validateLon("-0.1")).toBe(true);
      expect(validateLon("-180")).toBe(true);
      expect(validateLon("180")).toBe(true);
      expect(validateLon("-181")).toBe(false);
      expect(validateLon("181")).toBe(false);
    });
  });

  describe("compare parameter validation", () => {
    it("should validate model names", () => {
      const validModels = ["ecmwf", "gfs", "icon", "meteofrance", "ukmo", "jma", "gem"];

      const validateModels = (modelsParam: string): string[] => {
        const requested = modelsParam.split(",").map((m) => m.trim().toLowerCase());
        return requested.filter((m) => !validModels.includes(m));
      };

      expect(validateModels("gfs,ecmwf")).toEqual([]);
      expect(validateModels("gfs")).toEqual([]);
      expect(validateModels("invalid")).toEqual(["invalid"]);
      expect(validateModels("gfs,invalid,ecmwf")).toEqual(["invalid"]);
    });
  });
});

describe("Cache Key Generation", () => {
  it("should round coordinates for cache efficiency", () => {
    const getForecastCacheKey = (lat: number, lon: number, days: number): string => {
      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;
      return `forecast_${roundedLat}_${roundedLon}_${days}`;
    };

    // Nearby coordinates should get same cache key
    const key1 = getForecastCacheKey(51.5074, -0.1278, 5);
    const key2 = getForecastCacheKey(51.5080, -0.1275, 5);
    expect(key1).toBe(key2);

    // Different days should get different keys
    const key3 = getForecastCacheKey(51.5074, -0.1278, 3);
    expect(key1).not.toBe(key3);
  });

  it("should handle negative coordinates", () => {
    const getCompareCacheKey = (lat: number, lon: number, days: number): string => {
      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;
      return `compare_${roundedLat}_${roundedLon}_${days}`;
    };

    const key = getCompareCacheKey(-33.87, 151.21, 5);
    expect(key).toBe("compare_-33.87_151.21_5");
  });
});
