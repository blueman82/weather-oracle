// @weather-oracle/web
// Optional web dashboard for Weather Oracle

import type { AggregatedForecast } from "@weather-oracle/core";

export function renderWeather(weather: AggregatedForecast): string {
  return JSON.stringify(weather, null, 2);
}
