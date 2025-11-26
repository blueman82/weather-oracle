"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeocodingResult } from "@weather-oracle/core";

interface GeocodeApiResponse {
  success: boolean;
  data?: {
    results: GeocodingResult[];
    query: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface LocationSearchProps {
  onLocationSelect: (location: GeocodingResult) => void;
  placeholder?: string;
  initialValue?: string;
}

export function LocationSearch({
  onLocationSelect,
  placeholder = "Search for a city...",
  initialValue = "",
}: LocationSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced query for API
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch location suggestions
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["geocode", debouncedQuery],
    queryFn: async (): Promise<GeocodingResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      const params = new URLSearchParams({
        q: debouncedQuery,
        count: "5",
      });

      const response = await fetch(`/api/geocode?${params}`);
      const json: GeocodeApiResponse = await response.json();

      if (!json.success || !json.data) {
        return [];
      }

      return json.data.results;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
  });

  const results = data ?? [];

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" && results.length > 0) {
          setIsOpen(true);
          setSelectedIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, results, selectedIndex]
  );

  // Handle selection
  const handleSelect = useCallback(
    (location: GeocodingResult) => {
      setQuery(location.name);
      setIsOpen(false);
      setSelectedIndex(-1);
      onLocationSelect(location);
    },
    [onLocationSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open dropdown when typing
  useEffect(() => {
    if (query.length >= 2 && results.length > 0) {
      setIsOpen(true);
    }
  }, [query, results]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-10 text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="location-listbox"
          aria-activedescendant={
            selectedIndex >= 0 ? `location-option-${selectedIndex}` : undefined
          }
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {(isLoading || isFetching) && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg
              className="w-5 h-5 text-primary-500 animate-spin"
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
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          id="location-listbox"
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
        >
          {results.map((result, index) => (
            <button
              key={`${result.coordinates.latitude}-${result.coordinates.longitude}`}
              id={`location-option-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-primary-50 dark:bg-primary-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {result.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {result.region ? `${result.region}, ` : ""}
                    {result.country}
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {result.coordinates.latitude.toFixed(2)},{" "}
                  {result.coordinates.longitude.toFixed(2)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen &&
        query.length >= 2 &&
        !isLoading &&
        !isFetching &&
        results.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              No locations found for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}
    </div>
  );
}
