#!/usr/bin/env bun
// @weather-oracle/cli
// Command-line interface for Weather Oracle

import type { WeatherData, AggregatedWeather } from "@weather-oracle/core";

async function main(): Promise<void> {
  console.log("Weather Oracle CLI");
  console.log("==================");
  console.log("Usage: weather-oracle <location>");
}

main().catch(console.error);

export { main };
