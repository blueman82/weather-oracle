// Weather data types

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  timestamp: Date;
  source: string;
}

export interface WeatherProvider {
  name: string;
  fetchWeather(location: string): Promise<WeatherData>;
}

export interface AggregatedWeather {
  location: string;
  data: WeatherData[];
  consensus: WeatherData | null;
  fetchedAt: Date;
}
