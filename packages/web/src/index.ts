// @weather-oracle/web
// Optional web dashboard for Weather Oracle

import type { AggregatedWeather } from "@weather-oracle/core";

export function renderWeather(weather: AggregatedWeather): string {
  return JSON.stringify(weather, null, 2);
}
