"use client";

import { useMemo } from "react";
import type { CompareResponseData, ModelComparisonEntry } from "../app/api/compare/route";
import type { ModelName } from "@weather-oracle/core";
import { WeatherIcon } from "./WeatherIcon";

interface ModelComparisonProps {
  data: CompareResponseData;
  selectedDate?: string;
}

const modelColors: Record<ModelName, string> = {
  ecmwf: "#2563eb", // blue
  gfs: "#dc2626", // red
  icon: "#16a34a", // green
  meteofrance: "#9333ea", // purple
  ukmo: "#ea580c", // orange
  jma: "#0891b2", // cyan
  gem: "#be123c", // rose
};

function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

function formatPrecip(mm: number): string {
  if (mm < 0.1) return "-";
  if (mm < 1) return "<1mm";
  return `${Math.round(mm)}mm`;
}

function formatWind(ms: number): string {
  // Convert m/s to km/h
  const kmh = ms * 3.6;
  return `${Math.round(kmh)}`;
}

export function ModelComparison({ data, selectedDate }: ModelComparisonProps) {
  const { models, outliers } = data;

  // Get the available dates from the first successful model
  const availableDates = useMemo(() => {
    const successfulModel = models.find((m) => m.status === "success");
    if (!successfulModel) return [];
    return successfulModel.forecast.daily.map((d) => d.date);
  }, [models]);

  // Use first date if none selected
  const currentDate = selectedDate ?? availableDates[0];

  // Get outlier models for this date
  const outlierModels = useMemo(() => {
    if (!currentDate) return new Set<ModelName>();
    const dateStr = new Date(currentDate).toISOString().split("T")[0];
    const outliersForDate = outliers.filter(
      (o) => o.timestamp.toString().split("T")[0] === dateStr
    );
    return new Set(outliersForDate.map((o) => o.model));
  }, [currentDate, outliers]);

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Get forecast data for current date
  const getModelForecast = (model: ModelComparisonEntry) => {
    if (model.status !== "success" || !currentDate) return null;
    return model.forecast.daily.find((d) => {
      const dDate = new Date(d.date).toDateString();
      const cDate = new Date(currentDate).toDateString();
      return dDate === cDate;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Model Comparison
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Compare forecasts from {models.filter((m) => m.status === "success").length} weather models
        </p>

        {/* Date selector */}
        {availableDates.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {availableDates.slice(0, 7).map((date) => (
              <button
                key={date}
                onClick={() => {
                  // This would normally update selectedDate via props callback
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  date === currentDate
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                {formatDateDisplay(date)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Conditions
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                High / Low
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Precipitation
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Wind (km/h)
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {models.map((model) => {
              const forecast = getModelForecast(model);
              const isOutlier = outlierModels.has(model.model);

              return (
                <tr
                  key={model.model}
                  className={`${
                    isOutlier
                      ? "bg-amber-50/50 dark:bg-amber-900/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  } transition-colors`}
                >
                  {/* Model name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: modelColors[model.model] }}
                      />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {model.info.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {model.info.resolution} resolution
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Weather conditions */}
                  <td className="px-6 py-4 text-center">
                    {forecast ? (
                      <div className="flex justify-center">
                        <WeatherIcon code={forecast.weatherCode} size="md" />
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Temperature */}
                  <td className="px-6 py-4 text-center">
                    {forecast ? (
                      <span className="text-slate-900 dark:text-white">
                        <span className="font-semibold">
                          {formatTemp(forecast.temperatureMax)}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500">
                          {formatTemp(forecast.temperatureMin)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Precipitation */}
                  <td className="px-6 py-4 text-center">
                    {forecast ? (
                      <div>
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatPrecip(forecast.precipitationTotal)}
                        </span>
                        {forecast.precipitationProbability > 0 && (
                          <span className="text-xs text-slate-500 ml-1">
                            ({Math.round(forecast.precipitationProbability)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Wind */}
                  <td className="px-6 py-4 text-center">
                    {forecast ? (
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatWind(forecast.windMaxSpeed)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 text-center">
                    {model.status === "success" ? (
                      isOutlier ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Outlier
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          OK
                        </span>
                      )
                    ) : (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        title={model.error}
                      >
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="p-6 bg-slate-50 dark:bg-slate-700/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-600">
              {data.summary.successfulModels}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              Models Active
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">
              {outlierModels.size}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              Outliers
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {data.summary.failedModels}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              Unavailable
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
