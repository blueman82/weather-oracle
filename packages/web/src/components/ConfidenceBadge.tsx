"use client";

import type { ConfidenceLevelName } from "@weather-oracle/core";

interface ConfidenceBadgeProps {
  level: ConfidenceLevelName;
  score: number;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

const levelConfig = {
  high: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    ring: "ring-green-500",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
    label: "High",
  },
  medium: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
    ring: "ring-amber-500",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    label: "Medium",
  },
  low: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    ring: "ring-red-500",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    label: "Low",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
  lg: "px-3 py-1.5 text-base gap-2",
};

export function ConfidenceBadge({
  level,
  score,
  showScore = false,
  size = "md",
  animated = false,
}: ConfidenceBadgeProps) {
  const config = levelConfig[level];
  const percentage = Math.round(score * 100);

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} ${animated ? "confidence-pulse" : ""}`}
      title={`${config.label} confidence: ${percentage}%`}
    >
      {config.icon}
      <span>
        {config.label}
        {showScore && <span className="ml-1 opacity-75">({percentage}%)</span>}
      </span>
    </span>
  );
}

interface ConfidenceMeterProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ConfidenceMeter({
  score,
  size = "md",
  showLabel = true,
}: ConfidenceMeterProps) {
  const percentage = Math.round(score * 100);
  const level: ConfidenceLevelName =
    score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
  const config = levelConfig[level];

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className={`text-xs font-medium ${config.text}`}>
            {config.label} Confidence
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {percentage}%
          </span>
        </div>
      )}
      <div
        className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${heightClasses[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            level === "high"
              ? "bg-green-500"
              : level === "medium"
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
