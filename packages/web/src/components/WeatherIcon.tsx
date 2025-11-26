"use client";

import type { WeatherCode } from "@weather-oracle/core";

interface WeatherIconProps {
  code: WeatherCode | number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Map WMO weather codes to icon names and descriptions
function getWeatherInfo(code: number): {
  icon: "sunny" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";
  description: string;
} {
  // Clear sky
  if (code === 0) return { icon: "sunny", description: "Clear sky" };

  // Mainly clear, partly cloudy
  if (code >= 1 && code <= 2) return { icon: "partly-cloudy", description: "Partly cloudy" };

  // Overcast
  if (code === 3) return { icon: "cloudy", description: "Overcast" };

  // Fog
  if (code >= 45 && code <= 48) return { icon: "fog", description: "Foggy" };

  // Drizzle
  if (code >= 51 && code <= 57) return { icon: "drizzle", description: "Drizzle" };

  // Rain
  if (code >= 61 && code <= 65) return { icon: "rain", description: "Rain" };
  if (code >= 66 && code <= 67) return { icon: "rain", description: "Freezing rain" };
  if (code >= 80 && code <= 82) return { icon: "rain", description: "Rain showers" };

  // Snow
  if (code >= 71 && code <= 77) return { icon: "snow", description: "Snow" };
  if (code >= 85 && code <= 86) return { icon: "snow", description: "Snow showers" };

  // Thunderstorm
  if (code >= 95 && code <= 99) return { icon: "thunderstorm", description: "Thunderstorm" };

  return { icon: "cloudy", description: "Mixed conditions" };
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

export function WeatherIcon({ code, size = "md", className = "" }: WeatherIconProps) {
  const { icon, description } = getWeatherInfo(code as number);

  const baseClass = `${sizeClasses[size]} ${className}`;

  switch (icon) {
    case "sunny":
      return (
        <svg className={`${baseClass} text-yellow-500`} viewBox="0 0 24 24" fill="currentColor" aria-label={description}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );

    case "partly-cloudy":
      return (
        <svg className={`${baseClass} text-slate-400`} viewBox="0 0 24 24" fill="none" aria-label={description}>
          <circle cx="10" cy="8" r="3" fill="#fbbf24" />
          <path d="M10 2v1.5M10 11.5V13M3.64 4.64l1.06 1.06M15.3 4.64l-1.06 1.06M2.5 8H4M16 8h1.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 18h8a4 4 0 000-8h-.5a5.5 5.5 0 00-10.67 1.4A3.5 3.5 0 008 18z" fill="currentColor" />
        </svg>
      );

    case "cloudy":
      return (
        <svg className={`${baseClass} text-slate-400`} viewBox="0 0 24 24" fill="currentColor" aria-label={description}>
          <path d="M6.5 19h11a4.5 4.5 0 001.13-8.86A6.5 6.5 0 005.07 12.1 4 4 0 006.5 19z" />
        </svg>
      );

    case "fog":
      return (
        <svg className={`${baseClass} text-slate-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label={description}>
          <path d="M4 14h16M4 10h16M4 18h16" />
        </svg>
      );

    case "drizzle":
      return (
        <svg className={`${baseClass} text-blue-400`} viewBox="0 0 24 24" fill="none" aria-label={description}>
          <path d="M6.5 12h11a4.5 4.5 0 001.13-8.86A6.5 6.5 0 005.07 5.1 4 4 0 006.5 12z" fill="currentColor" className="text-slate-400" />
          <path d="M8 15v2M12 16v2M16 15v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "rain":
      return (
        <svg className={`${baseClass} text-blue-500`} viewBox="0 0 24 24" fill="none" aria-label={description}>
          <path d="M6.5 11h11a4.5 4.5 0 001.13-8.86A6.5 6.5 0 005.07 4.1 4 4 0 006.5 11z" fill="currentColor" className="text-slate-400" />
          <path d="M7 14v3M11 13v4M15 14v3M19 13v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "snow":
      return (
        <svg className={`${baseClass} text-blue-200`} viewBox="0 0 24 24" fill="none" aria-label={description}>
          <path d="M6.5 10h11a4.5 4.5 0 001.13-8.86A6.5 6.5 0 005.07 3.1 4 4 0 006.5 10z" fill="currentColor" className="text-slate-400" />
          <circle cx="8" cy="15" r="1.5" fill="currentColor" />
          <circle cx="12" cy="17" r="1.5" fill="currentColor" />
          <circle cx="16" cy="14" r="1.5" fill="currentColor" />
          <circle cx="10" cy="20" r="1.5" fill="currentColor" />
          <circle cx="14" cy="20" r="1.5" fill="currentColor" />
        </svg>
      );

    case "thunderstorm":
      return (
        <svg className={`${baseClass} text-slate-500`} viewBox="0 0 24 24" fill="none" aria-label={description}>
          <path d="M6.5 11h11a4.5 4.5 0 001.13-8.86A6.5 6.5 0 005.07 4.1 4 4 0 006.5 11z" fill="currentColor" />
          <path d="M13 11l-3 6h4l-2 5" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function getWeatherDescription(code: number): string {
  return getWeatherInfo(code).description;
}
