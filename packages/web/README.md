# @weather-oracle/web

Web application and REST API for Weather Oracle - built with Next.js 14.

## Features

- **REST API** - JSON endpoints for forecast and model comparison
- **Web Interface** - React-based UI with location search, forecast cards, and charts
- **Model Comparison** - Visual comparison of forecasts across weather models
- **Interactive Charts** - Temperature, precipitation, and wind charts using Recharts
- **Dark Mode** - Automatic dark mode support via Tailwind CSS
- **Responsive** - Mobile-friendly design

## Getting Started

### Development

```bash
# From the repository root
bun install

# Start development server
cd packages/web
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
bun run build
bun run start
```

## REST API

### GET /api/forecast

Get an aggregated weather forecast with confidence indicators.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | string | * | Location name to geocode |
| `lat` | number | * | Latitude (-90 to 90) |
| `lon` | number | * | Longitude (-180 to 180) |
| `days` | number | No | Forecast days (1-7, default: 5) |

*Must provide either `location` OR both `lat` and `lon`.

**Example Request:**

```bash
curl "http://localhost:3000/api/forecast?location=London&days=5"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "location": {
      "name": "London",
      "country": "United Kingdom",
      "coordinates": { "latitude": 51.5074, "longitude": -0.1278 }
    },
    "forecast": {
      "validFrom": "2024-01-15T00:00:00Z",
      "validTo": "2024-01-20T23:00:00Z",
      "daily": [...],
      "hourly": [...],
      "modelWeights": [...]
    },
    "confidence": {
      "level": "high",
      "score": 0.85
    },
    "narrative": {
      "headline": "Models agree on dry conditions through Friday.",
      "body": "High confidence: All 7 models agree...",
      "alerts": [],
      "modelNotes": []
    }
  },
  "meta": {
    "duration": 1234,
    "cached": false,
    "models": ["ecmwf", "gfs", "icon", "meteofrance", "ukmo", "jma", "gem"]
  }
}
```

### GET /api/compare

Get individual model forecasts for side-by-side comparison.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | string | * | Location name to geocode |
| `lat` | number | * | Latitude (-90 to 90) |
| `lon` | number | * | Longitude (-180 to 180) |
| `days` | number | No | Forecast days (1-7, default: 5) |
| `models` | string | No | Comma-separated list of models |

**Example Request:**

```bash
curl "http://localhost:3000/api/compare?location=Tokyo&models=ecmwf,gfs,icon"
```

### GET /api/geocode

Search for locations by name.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Maximum results (1-10, default: 5) |

**Example Request:**

```bash
curl "http://localhost:3000/api/geocode?q=Paris&count=5"
```

## Components

### LocationSearch

Location autocomplete with debounced search:

```tsx
import { LocationSearch } from "@/components";

<LocationSearch
  onLocationSelect={(location) => console.log(location)}
  placeholder="Search for a city..."
/>
```

### ForecastCard

Display forecast with confidence indicators:

```tsx
import { ForecastCard } from "@/components";

<ForecastCard data={forecastData} />
```

### ModelComparison

Side-by-side model comparison table:

```tsx
import { ModelComparison } from "@/components";

<ModelComparison data={compareData} />
```

### WeatherChart

Interactive charts for model data:

```tsx
import { WeatherChart } from "@/components";

<WeatherChart
  data={compareData}
  metric="temperature" // or "precipitation" | "wind"
/>
```

### ConfidenceBadge

Display confidence level:

```tsx
import { ConfidenceBadge } from "@/components";

<ConfidenceBadge level="high" score={0.85} showScore />
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NEXT_PUBLIC_API_URL` | API base URL (for client) | (relative) |

## Project Structure

```
packages/web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   │   ├── forecast/    # /api/forecast
│   │   │   ├── compare/     # /api/compare
│   │   │   └── geocode/     # /api/geocode
│   │   ├── page.tsx         # Home page
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components
│   │   ├── ForecastCard.tsx
│   │   ├── ModelComparison.tsx
│   │   ├── LocationSearch.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── WeatherChart.tsx
│   └── lib/                 # Utilities
├── public/                  # Static assets
└── tailwind.config.ts       # Tailwind configuration
```

## Dependencies

- `next` - React framework
- `react` - UI library
- `@tanstack/react-query` - Data fetching
- `recharts` - Charting library
- `tailwindcss` - Styling
- `@weather-oracle/core` - Core types and APIs
