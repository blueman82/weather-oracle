# Weather Oracle

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue)](https://www.typescriptlang.org/)

**Multi-model weather forecast aggregator** - Get consensus forecasts from 7 weather models with confidence indicators and narrative summaries.

Weather Oracle fetches forecasts from multiple weather models (ECMWF, GFS, ICON, and more), aggregates them using statistical methods, and provides confidence levels so you know not just *what* the weather will be, but *how certain* we are about it.

## Features

- **7 Weather Models** - Aggregates forecasts from ECMWF IFS, GFS, ICON, ARPEGE, UK Met Office, JMA GSM, and GEM
- **Confidence Scoring** - Know how much to trust the forecast based on model agreement
- **Narrative Summaries** - Plain language explanations
- **Multi-Platform** - CLI for terminal, REST API, and web interface
- **Smart Caching** - Reduces redundant API calls with file-based caching
- **No API Keys Required** - Uses the free Open-Meteo API

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.1.0

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/weather-oracle.git
cd weather-oracle

# Install dependencies
bun install

# Build all packages
bun run build
```

### Install CLI Globally (Optional)

```bash
# Link the CLI package globally
cd packages/cli && bun link

# Now you can run from anywhere:
weather-oracle forecast "London"
forecast forecast "London"  # shorthand alias
```

### Get Your First Forecast

```bash
# Using global command (after bun link)
weather-oracle forecast "London"

# Or run directly with bun
bun run packages/cli/src/index.ts forecast "London"
```

Output:
```
☀️  London, United Kingdom - Weather Outlook
══════════════════════════════════════════════════

📊 Model Consensus: HIGH CONFIDENCE
   7 of 7 models contributing to forecast
   Models agree on dry conditions through Friday.

🌡️  Temperature: 12-18°C
💧 Precipitation: 15% chance
💨 Wind: 24 km/h SW
💦 Humidity: 45-72%
```

## Usage

### CLI Commands

```bash
# Get a forecast with narrative summary
bun run packages/cli/src/index.ts forecast "New York"

# Compare individual models side-by-side
bun run packages/cli/src/index.ts compare "Tokyo"

# Customize output
bun run packages/cli/src/index.ts forecast "Paris" --days 5 --format json
bun run packages/cli/src/index.ts forecast "Sydney" --units imperial
bun run packages/cli/src/index.ts forecast "Berlin" --models ecmwf,gfs,icon
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-d, --days <n>` | Forecast days (1-14, default: 7) |
| `-m, --models <list>` | Models to query (comma-separated) |
| `-u, --units <type>` | Temperature units (metric/imperial) |
| `-f, --format <type>` | Output format (table/json/narrative/minimal) |
| `-v, --verbose` | Show detailed output including model notes |
| `--no-cache` | Fetch fresh data from API |
| `--no-color` | Disable colored output |

### Available Models

| Model | Provider | Resolution | Update Frequency |
|-------|----------|------------|------------------|
| `ecmwf` | European Centre for Medium-Range Weather Forecasts | 9km | 6 hours |
| `gfs` | NOAA/NCEP | 13km | 6 hours |
| `icon` | Deutscher Wetterdienst | 7km | 6 hours |
| `meteofrance` | Météo-France | 10km | 6 hours |
| `ukmo` | UK Meteorological Office | 10km | 6 hours |
| `jma` | Japan Meteorological Agency | 20km | 6 hours |
| `gem` | Environment Canada | 15km | 12 hours |

### Web Interface

```bash
# Start the development server
cd packages/web
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the web interface.

### REST API

```bash
# Start the web server
cd packages/web
bun run dev
```

#### Get Forecast

```bash
curl "http://localhost:3000/api/forecast?location=London"
# or with coordinates
curl "http://localhost:3000/api/forecast?lat=51.5074&lon=-0.1278&days=5"
```

#### Compare Models

```bash
curl "http://localhost:3000/api/compare?location=Tokyo"
```

#### Geocode Location

```bash
curl "http://localhost:3000/api/geocode?q=Paris"
```

See [docs/API.md](docs/API.md) for complete API documentation.

## Configuration

Weather Oracle can be configured via a `~/.config/weather-oracle/config.json` file:

```json
{
  "api": {
    "forecast": "https://api.open-meteo.com/v1/forecast",
    "geocoding": "https://geocoding-api.open-meteo.com/v1/search"
  },
  "cache": {
    "enabled": true,
    "ttlSeconds": 300,
    "maxEntries": 100
  },
  "models": {
    "defaults": ["ecmwf", "gfs", "icon"],
    "timeout": 30000,
    "retries": 2
  },
  "display": {
    "units": "metric",
    "outputFormat": "table",
    "showConfidence": true,
    "colorOutput": true
  }
}
```

## Project Structure

```
weather-oracle/
├── packages/
│   ├── core/           # Shared types, API clients, aggregation engine
│   ├── cli/            # Command-line interface
│   └── web/            # Next.js web application
├── docs/               # Documentation
└── package.json        # Workspace root
```

## How It Works

1. **Geocoding** - Location names are resolved to coordinates using Open-Meteo's geocoding API
2. **Multi-Model Fetch** - Forecasts are fetched from all available models in parallel
3. **Aggregation** - Forecasts are combined using robust statistical methods:
   - Temperature: Trimmed mean (excludes outliers)
   - Precipitation: Ensemble probability (% of models predicting > 0.1mm)
   - Wind: Median (robust to outliers)
4. **Confidence Calculation** - Model agreement is analyzed to determine confidence levels
5. **Narrative Generation** - Plain language summaries explain the forecast and highlight uncertainties

## Contributing

Contributions are welcome! Please see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Open-Meteo](https://open-meteo.com/) for providing free weather data APIs
- Inspired by [Carlow Weather](https://x.com/CarlowWeather?s=20) for their approach to communicating forecast uncertainty
