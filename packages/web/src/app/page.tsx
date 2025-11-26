"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeocodingResult } from "@weather-oracle/core";
import {
  LocationSearch,
  ForecastCard,
  ModelComparison,
  WeatherChart,
} from "../components";
import type { ForecastResponseData } from "./api/forecast/route";
import type { CompareResponseData } from "./api/compare/route";

type ChartMetric = "temperature" | "precipitation" | "wind";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export default function HomePage() {
  const [selectedLocation, setSelectedLocation] =
    useState<GeocodingResult | null>(null);
  const [activeTab, setActiveTab] = useState<"forecast" | "compare" | "chart">(
    "forecast"
  );
  const [chartMetric, setChartMetric] = useState<ChartMetric>("temperature");

  // Fetch forecast data
  const {
    data: forecastData,
    isLoading: forecastLoading,
    error: forecastError,
  } = useQuery({
    queryKey: ["forecast", selectedLocation?.coordinates],
    queryFn: async (): Promise<ForecastResponseData | null> => {
      if (!selectedLocation) return null;

      const params = new URLSearchParams({
        lat: selectedLocation.coordinates.latitude.toString(),
        lon: selectedLocation.coordinates.longitude.toString(),
        days: "7",
      });

      const response = await fetch(`/api/forecast?${params}`);
      const json: ApiResponse<ForecastResponseData> = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? "Failed to fetch forecast");
      }

      return json.data;
    },
    enabled: !!selectedLocation,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch comparison data
  const {
    data: compareData,
    isLoading: compareLoading,
    error: compareError,
  } = useQuery({
    queryKey: ["compare", selectedLocation?.coordinates],
    queryFn: async (): Promise<CompareResponseData | null> => {
      if (!selectedLocation) return null;

      const params = new URLSearchParams({
        lat: selectedLocation.coordinates.latitude.toString(),
        lon: selectedLocation.coordinates.longitude.toString(),
        days: "7",
      });

      const response = await fetch(`/api/compare?${params}`);
      const json: ApiResponse<CompareResponseData> = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? "Failed to fetch comparison");
      }

      return json.data;
    },
    enabled: !!selectedLocation && activeTab !== "forecast",
    staleTime: 5 * 60 * 1000,
  });

  const handleLocationSelect = useCallback((location: GeocodingResult) => {
    setSelectedLocation(location);
  }, []);

  const isLoading =
    forecastLoading || (activeTab !== "forecast" && compareLoading);
  const error = forecastError ?? (activeTab !== "forecast" ? compareError : null);

  return (
    <div className="space-y-8">
      {/* Search section */}
      <section className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Multi-Model Weather Forecasts
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
          Get aggregated forecasts from 7 weather models with confidence
          indicators and narrative summaries. Understand not just what the
          weather will be, but how certain we are about it.
        </p>
        <div className="flex justify-center">
          <LocationSearch
            onLocationSelect={handleLocationSelect}
            placeholder="Search for a city or location..."
          />
        </div>
      </section>

      {/* Main content */}
      {selectedLocation ? (
        <>
          {/* Tab navigation */}
          <div className="flex justify-center">
            <div className="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab("forecast")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "forecast"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Forecast
              </button>
              <button
                onClick={() => setActiveTab("compare")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "compare"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Model Comparison
              </button>
              <button
                onClick={() => setActiveTab("chart")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "chart"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Charts
              </button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <svg
                  className="w-12 h-12 text-primary-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-slate-600 dark:text-slate-400">
                  Fetching forecasts from multiple models...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <svg
                className="w-12 h-12 text-red-500 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                Failed to load forecast
              </h3>
              <p className="text-red-600 dark:text-red-400">
                {error instanceof Error ? error.message : "An error occurred"}
              </p>
            </div>
          )}

          {/* Content based on active tab */}
          {!isLoading && !error && (
            <>
              {activeTab === "forecast" && forecastData && (
                <div className="max-w-2xl mx-auto">
                  <ForecastCard data={forecastData} />
                </div>
              )}

              {activeTab === "compare" && compareData && (
                <ModelComparison data={compareData} />
              )}

              {activeTab === "chart" && compareData && (
                <div className="space-y-6">
                  {/* Chart metric selector */}
                  <div className="flex justify-center">
                    <div className="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
                      <button
                        onClick={() => setChartMetric("temperature")}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          chartMetric === "temperature"
                            ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        Temperature
                      </button>
                      <button
                        onClick={() => setChartMetric("precipitation")}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          chartMetric === "precipitation"
                            ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        Precipitation
                      </button>
                      <button
                        onClick={() => setChartMetric("wind")}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          chartMetric === "wind"
                            ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        Wind
                      </button>
                    </div>
                  </div>
                  <WeatherChart data={compareData} metric={chartMetric} />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Enter a location to get started
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Search for a city or location above to see multi-model weather
            forecasts with confidence indicators.
          </p>

          {/* Example locations */}
          <div className="mt-8">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Try these popular locations:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { name: "New York", lat: 40.7128, lon: -74.006 },
                { name: "London", lat: 51.5074, lon: -0.1278 },
                { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
                { name: "Sydney", lat: -33.8688, lon: 151.2093 },
              ].map((location) => (
                <button
                  key={location.name}
                  onClick={() =>
                    setSelectedLocation({
                      name: location.name,
                      coordinates: {
                        latitude: location.lat,
                        longitude: location.lon,
                      } as GeocodingResult["coordinates"],
                      country: "",
                      countryCode: "",
                      timezone: "UTC" as GeocodingResult["timezone"],
                    })
                  }
                  className="px-4 py-2 bg-white dark:bg-slate-800 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
