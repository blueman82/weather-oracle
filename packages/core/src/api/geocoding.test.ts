/**
 * Tests for geocoding client.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { geocodeLocation, searchLocations } from "./geocoding";
import { GeocodingError } from "../errors/geocoding";
import { ErrorCode } from "../errors/base";

/**
 * Create a mock geocoding API response
 */
function createMockGeocodingResponse(results: Array<{
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
  population?: number;
}>): object {
  return {
    results: results.map((r, i) => ({
      id: r.id ?? 1000 + i,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      elevation: r.elevation ?? 0,
      feature_code: "PPL",
      country_code: r.country_code ?? "US",
      country: r.country ?? "United States",
      country_id: 1,
      admin1: r.admin1,
      admin1_id: 1,
      admin2: r.admin2,
      admin2_id: 2,
      timezone: r.timezone ?? "America/New_York",
      population: r.population ?? 100000,
    })),
    generationtime_ms: 0.5,
  };
}

/**
 * Helper to create a mock fetch function
 */
function createMockFetch(
  handler: (url: string | URL | Request) => Promise<Response>
): typeof globalThis.fetch {
  const mockFn = mock(handler) as unknown as typeof globalThis.fetch;
  // Add preconnect method to satisfy fetch type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockFn as any).preconnect = () => {};
  return mockFn;
}

describe("geocodeLocation", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should geocode a simple city name", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "London",
        latitude: 51.5074,
        longitude: -0.1278,
        country_code: "GB",
        country: "United Kingdom",
        admin1: "England",
        timezone: "Europe/London",
        population: 8982000,
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("London", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(result.name).toBe("London");
    expect(result.country).toBe("United Kingdom");
    expect(result.countryCode).toBe("GB");
    expect(result.region).toBe("England");
    expect(result.timezone as string).toBe("Europe/London");
    expect(result.coordinates.latitude as number).toBeCloseTo(51.5074, 4);
    expect(result.coordinates.longitude as number).toBeCloseTo(-0.1278, 4);
    expect(result.population).toBe(8982000);
  });

  it("should build URL with correct parameters", async () => {
    let capturedUrl: string | undefined;

    const mockResponse = createMockGeocodingResponse([
      {
        name: "Paris",
        latitude: 48.8566,
        longitude: 2.3522,
        country: "France",
        country_code: "FR",
      },
    ]);

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await geocodeLocation("Paris", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      count: 10,
      language: "fr",
    });

    expect(capturedUrl).toBeDefined();
    expect(capturedUrl).toContain("geocoding-api.open-meteo.com/v1/search");
    expect(capturedUrl).toContain("name=Paris");
    expect(capturedUrl).toContain("count=10");
    expect(capturedUrl).toContain("language=fr");
    expect(capturedUrl).toContain("format=json");
  });

  it("should throw GeocodingError for empty results", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(
      geocodeLocation("NonexistentPlace12345", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should throw GeocodingError for no results field", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(
      geocodeLocation("AnotherNonexistent", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should throw GeocodingError for HTTP errors", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        })
      )
    );

    await expect(
      geocodeLocation("London", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should handle network errors gracefully", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.reject(new Error("Network error"))
    );

    await expect(
      geocodeLocation("London", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should return best match (first result)", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "London",
        latitude: 51.5074,
        longitude: -0.1278,
        country: "United Kingdom",
        country_code: "GB",
        population: 8982000,
      },
      {
        name: "London",
        latitude: 42.9834,
        longitude: -81.2497,
        country: "Canada",
        country_code: "CA",
        admin1: "Ontario",
        population: 383822,
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("London", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    // Should return UK London (first/most relevant result)
    expect(result.country).toBe("United Kingdom");
    expect(result.population).toBe(8982000);
  });

  it("should use admin2 if admin1 is not available", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "SmallTown",
        latitude: 40.0,
        longitude: -74.0,
        country: "United States",
        country_code: "US",
        admin2: "County Name",
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("SmallTown", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(result.region).toBe("County Name");
  });

  it("should include elevation when available", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "Denver",
        latitude: 39.7392,
        longitude: -104.9903,
        country: "United States",
        country_code: "US",
        elevation: 1609,
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("Denver", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(result.elevation as number).toBe(1609);
  });
});

describe("geocodeLocation validation", () => {
  it("should reject empty query", async () => {
    await expect(
      geocodeLocation("", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should reject whitespace-only query", async () => {
    await expect(
      geocodeLocation("   ", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should reject query shorter than 2 characters", async () => {
    await expect(
      geocodeLocation("A", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should reject query longer than 200 characters", async () => {
    const longQuery = "A".repeat(201);
    await expect(
      geocodeLocation(longQuery, {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should trim whitespace from query", async () => {
    let capturedUrl: string | undefined;

    const mockResponse = createMockGeocodingResponse([
      {
        name: "Tokyo",
        latitude: 35.6762,
        longitude: 139.6503,
        country: "Japan",
        country_code: "JP",
      },
    ]);

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await geocodeLocation("  Tokyo  ", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(capturedUrl).toContain("name=Tokyo");
    expect(capturedUrl).not.toContain("name=++Tokyo");
  });
});

describe("searchLocations", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return multiple locations", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "Springfield",
        latitude: 39.7817,
        longitude: -89.6501,
        country: "United States",
        country_code: "US",
        admin1: "Illinois",
      },
      {
        name: "Springfield",
        latitude: 37.2153,
        longitude: -93.2982,
        country: "United States",
        country_code: "US",
        admin1: "Missouri",
      },
      {
        name: "Springfield",
        latitude: 42.1015,
        longitude: -72.5898,
        country: "United States",
        country_code: "US",
        admin1: "Massachusetts",
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const results = await searchLocations("Springfield", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      count: 10,
    });

    expect(results.length).toBe(3);
    expect(results[0].name).toBe("Springfield");
    expect(results[0].region).toBe("Illinois");
    expect(results[1].region).toBe("Missouri");
    expect(results[2].region).toBe("Massachusetts");
  });

  it("should return empty array for no results", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const results = await searchLocations("NonexistentPlace12345", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(results).toEqual([]);
  });

  it("should return empty array for missing results field", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const results = await searchLocations("Whatever", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(results).toEqual([]);
  });

  it("should throw GeocodingError for HTTP errors", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response("Service Unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        })
      )
    );

    await expect(
      searchLocations("London", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });

  it("should validate query same as geocodeLocation", async () => {
    await expect(
      searchLocations("", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      })
    ).rejects.toThrow(GeocodingError);
  });
});

describe("geocoding with default options", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should use default count of 5", async () => {
    let capturedUrl: string | undefined;

    const mockResponse = createMockGeocodingResponse([
      {
        name: "Berlin",
        latitude: 52.52,
        longitude: 13.405,
        country: "Germany",
        country_code: "DE",
      },
    ]);

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await geocodeLocation("Berlin", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(capturedUrl).toContain("count=5");
  });

  it("should use default language of en", async () => {
    let capturedUrl: string | undefined;

    const mockResponse = createMockGeocodingResponse([
      {
        name: "Tokyo",
        latitude: 35.6762,
        longitude: 139.6503,
        country: "Japan",
        country_code: "JP",
      },
    ]);

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await geocodeLocation("Tokyo", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(capturedUrl).toContain("language=en");
  });
});

describe("geocoding error handling", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should include query in GeocodingError for not found", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      await geocodeLocation("UnknownPlace", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(GeocodingError);
      expect((error as GeocodingError).query).toBe("UnknownPlace");
      expect((error as GeocodingError).code).toBe(ErrorCode.GEOCODING_NOT_FOUND);
    }
  });

  it("should include query in GeocodingError for service error", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.reject(new Error("Connection refused"))
    );

    try {
      await geocodeLocation("London", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(GeocodingError);
      expect((error as GeocodingError).query).toBe("London");
      expect((error as GeocodingError).code).toBe(ErrorCode.GEOCODING_SERVICE_ERROR);
    }
  });

  it("should include query in GeocodingError for invalid input", async () => {
    try {
      await geocodeLocation("", {
        endpoint: "https://geocoding-api.open-meteo.com/v1/search",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(GeocodingError);
      expect((error as GeocodingError).code).toBe(ErrorCode.GEOCODING_INVALID_INPUT);
    }
  });
});

describe("geocoding timezone handling", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should default to UTC if timezone is not provided", async () => {
    const mockResponse = {
      results: [
        {
          id: 1,
          name: "SomePlace",
          latitude: 0.0,
          longitude: 0.0,
          country: "Country",
          country_code: "XX",
          // No timezone field
        },
      ],
      generationtime_ms: 0.5,
    };

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("SomePlace", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(result.timezone as string).toBe("UTC");
  });

  it("should use provided timezone", async () => {
    const mockResponse = createMockGeocodingResponse([
      {
        name: "Sydney",
        latitude: -33.8688,
        longitude: 151.2093,
        country: "Australia",
        country_code: "AU",
        timezone: "Australia/Sydney",
      },
    ]);

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await geocodeLocation("Sydney", {
      endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    });

    expect(result.timezone as string).toBe("Australia/Sydney");
  });
});
