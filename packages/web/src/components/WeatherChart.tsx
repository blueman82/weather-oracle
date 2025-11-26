"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import type { CompareResponseData } from "../app/api/compare/route";
import type { ModelName } from "@weather-oracle/core";

interface WeatherChartProps {
  data: CompareResponseData;
  metric?: "temperature" | "precipitation" | "wind";
}

const modelColors: Record<ModelName, string> = {
  ecmwf: "#2563eb",
  gfs: "#dc2626",
  icon: "#16a34a",
  meteofrance: "#9333ea",
  ukmo: "#ea580c",
  jma: "#0891b2",
  gem: "#be123c",
};

const modelNames: Record<ModelName, string> = {
  ecmwf: "ECMWF",
  gfs: "GFS",
  icon: "ICON",
  meteofrance: "ARPEGE",
  ukmo: "UK Met",
  jma: "JMA",
  gem: "GEM",
};

type ChartDataPoint = {
  date: string;
  displayDate: string;
  [key: string]: string | number | undefined;
};

export function WeatherChart({ data, metric = "temperature" }: WeatherChartProps) {
  const { models } = data;

  // Prepare chart data
  const chartData = useMemo(() => {
    const successfulModels = models.filter((m) => m.status === "success");
    if (successfulModels.length === 0) return [];

    // Get all unique dates
    const allDates = new Set<string>();
    successfulModels.forEach((model) => {
      model.forecast.daily.forEach((d) => {
        allDates.add(d.date);
      });
    });

    // Sort dates
    const sortedDates = Array.from(allDates).sort();

    // Build data points
    return sortedDates.map((date) => {
      const dateObj = new Date(date);
      const point: ChartDataPoint = {
        date,
        displayDate: dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      };

      successfulModels.forEach((model) => {
        const dayForecast = model.forecast.daily.find((d) => d.date === date);
        if (dayForecast) {
          switch (metric) {
            case "temperature":
              point[`${model.model}_high`] = Math.round(dayForecast.temperatureMax);
              point[`${model.model}_low`] = Math.round(dayForecast.temperatureMin);
              break;
            case "precipitation":
              point[model.model] = Math.round(dayForecast.precipitationTotal * 10) / 10;
              break;
            case "wind":
              // Convert m/s to km/h
              point[model.model] = Math.round(dayForecast.windMaxSpeed * 3.6);
              break;
          }
        }
      });

      return point;
    });
  }, [models, metric]);

  const successfulModels = models.filter((m) => m.status === "success");

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
        <p className="text-slate-500 dark:text-slate-400 text-center">
          No chart data available
        </p>
      </div>
    );
  }

  // Calculate min/max for Y axis
  const getYAxisDomain = () => {
    if (metric === "temperature") {
      let min = Infinity;
      let max = -Infinity;
      chartData.forEach((point) => {
        successfulModels.forEach((model) => {
          const high = point[`${model.model}_high`] as number | undefined;
          const low = point[`${model.model}_low`] as number | undefined;
          if (high !== undefined) max = Math.max(max, high);
          if (low !== undefined) min = Math.min(min, low);
        });
      });
      return [Math.floor(min - 2), Math.ceil(max + 2)];
    }
    return ["auto", "auto"];
  };

  const getYAxisLabel = () => {
    switch (metric) {
      case "temperature":
        return "Temperature (°C)";
      case "precipitation":
        return "Precipitation (mm)";
      case "wind":
        return "Wind Speed (km/h)";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Model Comparison - {metric.charAt(0).toUpperCase() + metric.slice(1)}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Spaghetti plot showing model spread
        </p>
      </div>

      <div className="p-6">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {metric === "temperature" ? (
              // Temperature uses high/low areas per model
              <ComposedChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke="#94a3b8"
                />
                <YAxis
                  domain={getYAxisDomain() as [number, number]}
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke="#94a3b8"
                  label={{
                    value: getYAxisLabel(),
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "#94a3b8" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number, name: string) => {
                    const [model, type] = name.split("_");
                    return [`${value}°C`, `${modelNames[model as ModelName]} ${type === "high" ? "High" : "Low"}`];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const [model] = value.split("_");
                    return modelNames[model as ModelName];
                  }}
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                {successfulModels.map((model) => (
                  <Area
                    key={model.model}
                    type="monotone"
                    dataKey={`${model.model}_high`}
                    stroke={modelColors[model.model]}
                    fill={modelColors[model.model]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
                {successfulModels.map((model) => (
                  <Line
                    key={`${model.model}_low`}
                    type="monotone"
                    dataKey={`${model.model}_low`}
                    stroke={modelColors[model.model]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </ComposedChart>
            ) : (
              // Precipitation/Wind use simple line chart
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke="#94a3b8"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke="#94a3b8"
                  label={{
                    value: getYAxisLabel(),
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "#94a3b8" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number, name: string) => {
                    const unit = metric === "precipitation" ? "mm" : "km/h";
                    return [`${value} ${unit}`, modelNames[name as ModelName]];
                  }}
                />
                <Legend
                  formatter={(value: string) => modelNames[value as ModelName]}
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                {successfulModels.map((model) => (
                  <Line
                    key={model.model}
                    type="monotone"
                    dataKey={model.model}
                    stroke={modelColors[model.model]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {metric === "temperature" ? (
              <>
                <strong>Solid lines:</strong> High temperatures,{" "}
                <strong>Dashed lines:</strong> Low temperatures.
                The spread between models indicates forecast uncertainty.
              </>
            ) : metric === "precipitation" ? (
              <>
                Shows total daily precipitation from each model.
                Wider spread indicates more uncertainty about rain/snow amounts.
              </>
            ) : (
              <>
                Maximum wind speeds (in km/h) predicted by each model.
                Converging lines suggest higher confidence.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
