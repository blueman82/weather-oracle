"use client";

import { ConfidenceBadge, ConfidenceMeter } from "./ConfidenceBadge";
import { WeatherIcon, getWeatherDescription } from "./WeatherIcon";
import type { ForecastResponseData } from "../app/api/forecast/route";
import type { AggregatedDailyForecast, ConfidenceLevelName } from "@weather-oracle/core";

interface ForecastCardProps {
  data: ForecastResponseData;
}

function formatDate(dateString: string): { day: string; date: string } {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  return {
    day: isToday
      ? "Today"
      : isTomorrow
        ? "Tomorrow"
        : date.toLocaleDateString("en-US", { weekday: "short" }),
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

function DailyForecastRow({ daily }: { daily: AggregatedDailyForecast }) {
  const { day, date } = formatDate(daily.date.toString());

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex items-center space-x-3 min-w-[120px]">
        <WeatherIcon code={daily.forecast.weatherCode} size="md" />
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{day}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{date}</p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* Temperature range */}
        <div className="text-right min-w-[80px]">
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatTemp(daily.forecast.temperature.max)}
          </span>
          <span className="text-slate-400 mx-1">/</span>
          <span className="text-slate-500 dark:text-slate-400">
            {formatTemp(daily.forecast.temperature.min)}
          </span>
        </div>

        {/* Precipitation probability */}
        <div className="flex items-center space-x-1 min-w-[60px]">
          <svg
            className="w-4 h-4 text-blue-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {Math.round(daily.forecast.precipitation.probability)}%
          </span>
        </div>

        {/* Confidence */}
        <div className="hidden sm:block">
          <ConfidenceBadge
            level={daily.confidence.level}
            score={daily.confidence.score}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

export function ForecastCard({ data }: ForecastCardProps) {
  const { location, forecast, confidence, narrative } = data;
  const todayForecast = forecast.daily[0];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
      {/* Header with location and current conditions */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{location.name}</h2>
            <p className="text-primary-100">
              {location.region ? `${location.region}, ` : ""}
              {location.country}
            </p>
          </div>
          <ConfidenceBadge
            level={confidence.level as ConfidenceLevelName}
            score={confidence.score}
            showScore
            size="md"
          />
        </div>

        {todayForecast && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <WeatherIcon
                code={todayForecast.forecast.weatherCode}
                size="xl"
                className="text-white"
              />
              <div>
                <p className="text-5xl font-light">
                  {formatTemp(todayForecast.forecast.temperature.max)}
                </p>
                <p className="text-primary-100">
                  {getWeatherDescription(todayForecast.forecast.weatherCode)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-primary-100">Feels like</p>
              <p className="text-2xl">
                {formatTemp(todayForecast.forecast.temperature.min)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Narrative summary */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          {narrative.headline}
        </h3>
        <p className="text-slate-600 dark:text-slate-300">{narrative.body}</p>

        {narrative.alerts.length > 0 && (
          <div className="mt-4 space-y-2">
            {narrative.alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start space-x-2 text-amber-700 dark:text-amber-400"
              >
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm">{alert}</span>
              </div>
            ))}
          </div>
        )}

        {/* Confidence meter */}
        <div className="mt-4">
          <ConfidenceMeter score={confidence.score} />
        </div>
      </div>

      {/* Daily forecast list */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          7-Day Forecast
        </h3>
        <div>
          {forecast.daily.map((daily, index) => (
            <DailyForecastRow key={index} daily={daily} />
          ))}
        </div>
      </div>

      {/* Model notes */}
      {narrative.modelNotes.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Model Notes
            </h4>
            <ul className="space-y-1">
              {narrative.modelNotes.map((note, i) => (
                <li
                  key={i}
                  className="text-sm text-slate-600 dark:text-slate-400"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
