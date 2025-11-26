<a id="top"></a>

# Weather Oracle

<p align="center">
  <img src="assets/banner.png" alt="Weather Oracle - Multi-model weather forecast aggregator" width="800">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue)](https://www.typescriptlang.org/)

**Multi-model weather forecast aggregator** - Get consensus forecasts from 7 weather models with confidence indicators and narrative summaries.

Weather Oracle fetches forecasts from multiple weather models (ECMWF, GFS, ICON, and more), aggregates them using statistical methods, and provides confidence levels so you know not just *what* the weather will be, but *how certain* we are about it.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Install CLI Globally](#install-cli-globally-optional)
  - [Get Your First Forecast](#get-your-first-forecast)
- [Usage](#usage)
  - [CLI Commands](#cli-commands)
  - [CLI Options](#cli-options)
  - [Available Models](#available-models)
  - [Web Interface](#web-interface)
  - [REST API](#rest-api)
- [Configuration](#configuration)
  - [Configuration Options](#configuration-options)
  - [Example Config File](#example-config-file)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Features

- **7 Weather Models** - Aggregates forecasts from ECMWF IFS, GFS, ICON, ARPEGE, UK Met Office, JMA GSM, and GEM
- **Confidence Scoring** - Know how much to trust the forecast based on model agreement
- **Narrative Summaries** - Plain language explanations
- **Multi-Platform** - CLI for terminal, REST API, and web interface
- **Smart Caching** - Reduces redundant API calls with file-based caching
- **No API Keys Required** - Uses the free Open-Meteo API

<p align="right"><a href="#top">⬆️ Back to top</a></p>

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

<p align="right"><a href="#top">⬆️ Back to top</a></p>

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

# Manage configuration
bun run packages/cli/src/index.ts config                           # Show all
bun run packages/cli/src/index.ts config set display.units imperial # Set value
bun run packages/cli/src/index.ts config get display.units          # Get value
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Show version number |
| `-d, --days <n>` | Forecast days (1-16, default: 7) |
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

<p align="right"><a href="#top">⬆️ Back to top</a></p>

## Configuration

Weather Oracle stores configuration at `~/.weather-oracle/config.json`. Use the `config` command to manage settings:

```bash
# Show all configuration
weather-oracle config

# Set temperature units to Fahrenheit
weather-oracle config set display.units imperial

# Use more weather models by default
weather-oracle config set models.defaults ecmwf,gfs,icon,meteofrance,ukmo

# Get a specific value
weather-oracle config get display.units

# Reset to defaults
weather-oracle config reset --force
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `display.units` | Temperature units: `metric` (°C) or `imperial` (°F) | metric |
| `display.outputFormat` | Output format: `table`, `json`, `minimal` | table |
| `display.colorOutput` | Enable colored terminal output | true |
| `models.defaults` | Weather models to query by default | ecmwf,gfs,icon |
| `models.timeout` | API timeout in milliseconds | 30000 |
| `cache.enabled` | Cache forecasts to reduce API calls | true |
| `cache.ttlSeconds` | Cache validity in seconds (300 = 5 min) | 300 |

### Example Config File

```json
{
  "display": {
    "units": "imperial",
    "outputFormat": "table"
  },
  "models": {
    "defaults": ["ecmwf", "gfs", "icon", "meteofrance", "ukmo"]
  },
  "cache": {
    "ttlSeconds": 600
  }
}
```

See the [CLI README](packages/cli/README.md#config-command) for complete configuration documentation.

<p align="right"><a href="#top">⬆️ Back to top</a></p>

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

<p align="right"><a href="#top">⬆️ Back to top</a></p>

## How It Works

1. **Geocoding** - Location names are resolved to coordinates using Open-Meteo's geocoding API
2. **Multi-Model Fetch** - Forecasts are fetched from all available models in parallel
3. **Aggregation** - Forecasts are combined using robust statistical methods:
   - Temperature: Trimmed mean (excludes outliers)
   - Precipitation: Ensemble probability (% of models predicting > 0.1mm)
   - Wind: Median (robust to outliers)
4. **Confidence Calculation** - Model agreement is analyzed to determine confidence levels
5. **Narrative Generation** - Plain language summaries explain the forecast and highlight uncertainties

<p align="right"><a href="#top">⬆️ Back to top</a></p>

## Contributing

Contributions are welcome! Please see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

<p align="right"><a href="#top">⬆️ Back to top</a></p>

## License

MIT License - see [LICENSE](LICENSE) for details.

<p align="right"><a href="#top">⬆️ Back to top</a></p>

## Acknowledgments

- [Open-Meteo](https://open-meteo.com/) for providing free weather data APIs
- Inspired by [Carlow Weather](https://x.com/CarlowWeather?s=20) for their approach to communicating forecast uncertainty

<p align="right"><a href="#top">⬆️ Back to top</a></p>
