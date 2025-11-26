# @weather-oracle/core

Core library for Weather Oracle - provides type definitions, API clients, aggregation engine, and utilities.

## Installation

This package is part of the Weather Oracle monorepo and is installed via workspace dependencies:

```json
{
  "dependencies": {
    "@weather-oracle/core": "workspace:*"
  }
}
```

## Modules

### Types (`types/`)

Branded types for type-safe weather data:

```typescript
import {
  // Location types
  Latitude, Longitude, Coordinates, Location, GeocodingResult,
  latitude, longitude, createCoordinates,

  // Weather types
  Celsius, Millimeters, MetersPerSecond, Humidity,
  celsius, toFahrenheit, millimeters, metersPerSecond,

  // Model types
  ModelName, ModelForecast, AggregatedForecast,
  ConfidenceLevel, confidenceLevel,
  MODEL_INFO,
} from "@weather-oracle/core";

// Type-safe coordinate creation (validates ranges)
const coords = createCoordinates(51.5074, -0.1278); // London

// Temperature with unit conversion
const temp = celsius(20);
const fahrenheit = toFahrenheit(temp); // 68
```

### API Clients (`api/`)

#### Geocoding

```typescript
import { geocodeLocation, searchLocations } from "@weather-oracle/core";

// Get best match for a location query
const result = await geocodeLocation("London");
console.log(result.name);        // "London"
console.log(result.country);     // "United Kingdom"
console.log(result.coordinates); // { latitude: 51.5074, longitude: -0.1278 }

// Search for multiple matches (for autocomplete)
const matches = await searchLocations("Springfield", { count: 10 });
```

#### Weather Forecast

```typescript
import { fetchModelForecast, OpenMeteoClient } from "@weather-oracle/core";

const location = {
  query: "London",
  resolved: await geocodeLocation("London"),
};

// Fetch from a single model
const forecast = await fetchModelForecast("ecmwf", location, {
  forecastDays: 7,
});

// Or use the client class for more control
const client = new OpenMeteoClient({ timeout: 30000 });
const result = await client.fetchModelForecast("gfs", location);
```

#### Multi-Model Fetch

```typescript
import { fetchAllModels, getDefaultModels } from "@weather-oracle/core";

const location = { query: "Tokyo", resolved: await geocodeLocation("Tokyo") };

// Fetch from all models in parallel
const result = await fetchAllModels(location);
console.log(`Success: ${result.forecasts.length}`);
console.log(`Failed: ${result.failures.length}`);
console.log(`Duration: ${result.totalDurationMs}ms`);

// Handle partial failures gracefully
for (const failure of result.failures) {
  console.warn(`${failure.model} failed: ${failure.error.message}`);
}

// Or fetch specific models only
const result2 = await fetchAllModels(location, ["ecmwf", "gfs", "icon"]);
```

### Aggregation Engine (`engine/`)

#### Forecast Aggregation

```typescript
import { aggregateForecasts, identifyOutliers } from "@weather-oracle/core";

const result = await fetchAllModels(location);
const aggregated = aggregateForecasts(result.forecasts);

// Aggregated consensus forecast
console.log(aggregated.consensus.daily[0].forecast.temperature);
console.log(aggregated.overallConfidence.level); // "high" | "medium" | "low"

// Per-metric ranges across models
const range = aggregated.consensus.daily[0].range;
console.log(`Temp range: ${range.temperatureMax.min}-${range.temperatureMax.max}°C`);

// Find outlier models
const outliers = identifyOutliers(result.forecasts);
for (const outlier of outliers) {
  console.log(`${outlier.model} is ${outlier.metric} outlier (z=${outlier.zScore})`);
}
```

#### Confidence Calculation

```typescript
import { calculateConfidence, calculateDailyConfidence } from "@weather-oracle/core";

const aggregated = aggregateForecasts(forecasts);

// Overall confidence
const overall = calculateConfidence(aggregated, "overall", 0);
console.log(overall.level);       // "high" | "medium" | "low"
console.log(overall.score);       // 0.0 - 1.0
console.log(overall.explanation); // "High confidence: 5 of 5 models agree..."

// Per-metric confidence
const tempConfidence = calculateConfidence(aggregated, "temperature", 0);
const precipConfidence = calculateConfidence(aggregated, "precipitation", 0);

// Daily confidence with time decay
const day3Confidence = calculateDailyConfidence(
  aggregated.consensus.daily[2],
  aggregated.models.length,
  3 // days ahead
);
```

#### Narrative Generation

```typescript
import { generateNarrative } from "@weather-oracle/core";

const aggregated = aggregateForecasts(forecasts);
const confidence = [calculateConfidence(aggregated, "overall")];

const narrative = generateNarrative(aggregated, confidence);
console.log(narrative.headline);   // "Models agree on dry conditions through Wednesday."
console.log(narrative.body);       // "ECMWF and GFS show heavier rain..."
console.log(narrative.alerts);     // ["Extended range uncertainty beyond day 5..."]
console.log(narrative.modelNotes); // ["JMA is notably warmer at 24°C."]
```

### Configuration (`config/`)

```typescript
import { loadConfig, validateConfig, DEFAULT_CONFIG } from "@weather-oracle/core";

// Load from file + environment + overrides
const config = await loadConfig({
  overrides: {
    display: { units: "imperial" },
    models: { defaults: ["ecmwf", "gfs"] },
  },
});

// Validate partial config
const validated = validateConfig({
  cache: { enabled: false },
});
```

### Caching (`cache/`)

```typescript
import { createCacheManager, createForecastCacheKey } from "@weather-oracle/core";

const cache = createCacheManager({
  enabled: true,
  directory: "/tmp/weather-cache",
});

// Cache with custom TTL
await cache.set("key", data, 3600); // 1 hour TTL
const cached = await cache.get<MyData>("key");

// Forecast-specific cache key
const key = createForecastCacheKey(51.5, -0.12, "ecmwf,gfs", new Date());
```

### Error Handling (`errors/`)

```typescript
import {
  WeatherOracleError,
  GeocodingError,
  ApiError,
  isGeocodingError,
  isApiError,
} from "@weather-oracle/core";

try {
  await geocodeLocation("NonexistentPlace12345");
} catch (error) {
  if (isGeocodingError(error)) {
    switch (error.code) {
      case "GEOCODING_NOT_FOUND":
        console.log("Location not found");
        break;
      case "GEOCODING_INVALID_INPUT":
        console.log("Invalid query:", error.userMessage);
        break;
    }
  }

  if (isApiError(error)) {
    if (error.code === "API_TIMEOUT") {
      console.log("Request timed out");
    }
  }
}
```

## API Reference

### Types

| Type | Description |
|------|-------------|
| `Latitude` | Branded number for latitude (-90 to 90) |
| `Longitude` | Branded number for longitude (-180 to 180) |
| `Celsius` | Branded number for temperature |
| `Millimeters` | Branded number for precipitation |
| `MetersPerSecond` | Branded number for wind speed |
| `ModelName` | Union type of available model names |
| `ConfidenceLevelName` | `"high" \| "medium" \| "low"` |

### Functions

| Function | Description |
|----------|-------------|
| `geocodeLocation(query)` | Resolve location name to coordinates |
| `fetchAllModels(location, models?, options?)` | Fetch forecasts from multiple models |
| `aggregateForecasts(forecasts)` | Combine model forecasts with consensus |
| `calculateConfidence(aggregated, metric, daysAhead)` | Calculate confidence level |
| `generateNarrative(aggregated, confidence)` | Generate plain language summary |
| `createCacheManager(options)` | Create a file-based cache manager |
| `loadConfig(options)` | Load configuration from file/env |

## Dependencies

- `zod` - Runtime schema validation
