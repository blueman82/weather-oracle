import WidgetKit
import SwiftUI

struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: String
    let condition: String
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: Date(), temperature: "72°", condition: "Sunny")
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        let entry = WeatherEntry(date: Date(), temperature: "72°", condition: "Sunny")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let entry = WeatherEntry(date: Date(), temperature: "72°", condition: "Sunny")
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct WeatherOracleWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "cloud.sun.fill")
                    .foregroundStyle(.blue, .yellow)
                Spacer()
            }

            Text(entry.temperature)
                .font(.title)
                .fontWeight(.bold)

            Text(entry.condition)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

@main
struct WeatherOracleWidget: Widget {
    let kind: String = "WeatherOracleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WeatherOracleWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Weather Oracle")
        .description("See current weather at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

#Preview(as: .systemSmall) {
    WeatherOracleWidget()
} timeline: {
    WeatherEntry(date: .now, temperature: "72°", condition: "Sunny")
}
