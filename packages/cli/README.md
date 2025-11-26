# @weather-oracle/cli

Command-line interface for Weather Oracle - get multi-model weather forecasts with confidence indicators.

## Installation

This package is part of the Weather Oracle monorepo. From the repository root:

```bash
bun install
```

### Global Installation (Recommended)

Link the CLI globally to use from anywhere:

```bash
cd packages/cli && bun link
```

After linking, you can run:

```bash
# Full command
weather-oracle forecast "London"

# Shorthand alias
forecast forecast "London"
```

## Commands

| Command | Description |
|---------|-------------|
| `forecast <location>` | Get weather forecast with model consensus |
| `compare <location>` | Compare forecasts across models side-by-side |
| `config` | Manage configuration settings |

## Usage

### Forecast Command

Get a weather forecast with narrative summary and confidence indicators:

```bash
# Basic usage
bun run packages/cli/src/index.ts forecast "London"

# With options
bun run packages/cli/src/index.ts forecast "New York" --days 5 --units imperial

# Output formats
bun run packages/cli/src/index.ts forecast "Tokyo" --format json
bun run packages/cli/src/index.ts forecast "Paris" --format table
bun run packages/cli/src/index.ts forecast "Berlin" --format minimal

# Select specific models
bun run packages/cli/src/index.ts forecast "Sydney" --models ecmwf,gfs,icon
```

**Example Output:**

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

High confidence: All 7 models agree on the forecast

⚠️  Alerts:
   • Extended range beyond 5 days carries higher uncertainty.
```

### Compare Command

Compare forecasts across weather models side-by-side:

```bash
# Basic usage
bun run packages/cli/src/index.ts compare "Tokyo"

# With options
bun run packages/cli/src/index.ts compare "London" --days 5
bun run packages/cli/src/index.ts compare "Paris" --models ecmwf,gfs,icon,ukmo
```

**Example Output:**

```
📊 Model Comparison: Tokyo, Japan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌡️  Temperature (°C) - High

         Mon    Tue    Wed    Thu    Fri
        ─────  ─────  ─────  ─────  ─────
ECMWF     22     24     23     21     19
GFS       21     23     22     20     18
ICON      22     24     23     21     19
ARPEGE    21     24     23     21     19
UK Met    22     24     23     21     18
        ─────  ─────  ─────  ─────  ─────
Spread    1°     1°     1°     1°     1°  ← Low uncertainty

💧 Precipitation Probability

         Mon    Tue    Wed    Thu    Fri
        ─────  ─────  ─────  ─────  ─────
ECMWF     10%    15%    35%    60%    45%
GFS       12%    18%    40%    65%    50%
ICON       8%    12%    32%    58%    42%
...

Based on 7/7 models. ██ within 1σ, ██ within 2σ, ██ >2σ from mean
```

### Config Command

Manage Weather Oracle configuration settings:

```bash
# Show all configuration
weather-oracle config

# Get a specific value
weather-oracle config get display.units

# Set a value
weather-oracle config set display.units imperial

# Remove a value (revert to default)
weather-oracle config unset display.units

# Show config file path
weather-oracle config path

# Reset to defaults
weather-oracle config reset --force

# List all valid configuration keys
weather-oracle config list-keys
```

**Example Output:**

```
Weather Oracle Configuration
──────────────────────────────────────────────────

[api]
  api.forecast = https://api.open-meteo.com/v1/forecast (default)
  api.geocoding = https://geocoding-api.open-meteo.com/v1/search (default)

[cache]
  cache.enabled = true (default)
  cache.ttlSeconds = 300 (default)

[models]
  models.defaults = ecmwf, gfs, icon (default)

[display]
  display.units = imperial (config file)
  display.outputFormat = table (default)

Config file: ~/.weather-oracle/config.json
```

#### Config Subcommands

| Subcommand | Description |
|------------|-------------|
| `config` | Show all configuration with sources |
| `config get <key>` | Get a single configuration value |
| `config set <key> <value>` | Set a configuration value |
| `config unset <key>` | Remove a value (revert to default) |
| `config path` | Show the configuration file path |
| `config reset --force` | Reset all settings to defaults |
| `config list-keys` | List all valid configuration keys |

#### Valid Configuration Keys

##### Display Settings

| Key | Type | Values | Default | Description |
|-----|------|--------|---------|-------------|
| `display.units` | enum | metric, imperial | metric | Temperature units in output. `metric` = Celsius, `imperial` = Fahrenheit |
| `display.outputFormat` | enum | json, table, minimal | table | Default output format for forecast/compare commands |
| `display.colorOutput` | boolean | true, false | true | Enable/disable colored terminal output |
| `display.showConfidence` | boolean | true, false | true | Show confidence indicators in forecast output |

##### Model Settings

| Key | Type | Values | Default | Description |
|-----|------|--------|---------|-------------|
| `models.defaults` | array | ecmwf,gfs,icon,meteofrance,ukmo,jma,gem | ecmwf,gfs,icon | Weather models to query when `--models` flag not specified |
| `models.timeout` | number | 1000-60000 | 30000 | API request timeout in milliseconds |

##### Cache Settings

| Key | Type | Values | Default | Description |
|-----|------|--------|---------|-------------|
| `cache.enabled` | boolean | true, false | true | Enable/disable forecast caching (reduces API calls) |
| `cache.ttlSeconds` | number | 0-86400 | 300 | How long cached forecasts are valid (seconds). 300 = 5 minutes |

##### API Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `api.forecast` | string | https://api.open-meteo.com/v1/forecast | Forecast API endpoint URL |
| `api.geocoding` | string | https://geocoding-api.open-meteo.com/v1/search | Geocoding API endpoint URL |

#### Config File Location

The configuration file is stored at `~/.weather-oracle/config.json` and works from any directory on your system.

```bash
# View your config file path
weather-oracle config path

# Example config file
cat ~/.weather-oracle/config.json
```

```json
{
  "display": {
    "units": "imperial"
  },
  "models": {
    "defaults": ["ecmwf", "gfs", "icon", "meteofrance", "ukmo"]
  },
  "cache": {
    "ttlSeconds": 600
  }
}
```

### Global Options

These options work with all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--version` | `-V` | Show version number |
| `--units <type>` | `-u` | Temperature units: `metric` (default) or `imperial` |
| `--days <n>` | `-d` | Forecast days: 1-14 (default: 7) |
| `--models <list>` | `-m` | Comma-separated list of models to use |
| `--format <type>` | `-f` | Output format: `table`, `json`, `narrative`, or `minimal` |
| `--verbose` | `-v` | Show detailed output including model notes |
| `--no-color` | | Disable colored output |
| `--no-cache` | | Fetch fresh data, skip cache |

### Command-Specific Options

#### Forecast

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and fetch fresh data from API |

#### Compare

| Option | Description |
|--------|-------------|
| `--days <n>` | Number of days to compare (1-7, default: 5) |

## Output Formats

### Narrative (default)

Human-readable format with weather icons, narrative summaries, and confidence indicators. Best for terminal use.

### Table

Structured table format showing daily forecasts with confidence levels.

### JSON

Machine-readable JSON output for scripting and integration:

```bash
bun run packages/cli/src/index.ts forecast "London" --format json | jq '.forecast.daily[0]'
```

### Minimal

Single-line output for status bars and quick checks:

```bash
bun run packages/cli/src/index.ts forecast "London" --format minimal
# ☀️ London: 12-18°C, 15% rain
```

## Available Models

| Model | ID | Provider |
|-------|-----|----------|
| ECMWF IFS | `ecmwf` | European Centre for Medium-Range Weather Forecasts |
| GFS | `gfs` | NOAA/NCEP |
| ICON | `icon` | Deutscher Wetterdienst |
| ARPEGE | `meteofrance` | Météo-France |
| UK Met Office | `ukmo` | UK Meteorological Office |
| JMA GSM | `jma` | Japan Meteorological Agency |
| GEM | `gem` | Environment Canada |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (location not found, API failure, etc.) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NO_COLOR` | Disable colored output (standard convention) |
| `FORCE_COLOR` | Force colored output even without TTY |

## Dependencies

- `commander` - CLI framework
- `chalk` - Terminal styling
- `ora` - Spinner animations
- `@weather-oracle/core` - Core types and APIs
