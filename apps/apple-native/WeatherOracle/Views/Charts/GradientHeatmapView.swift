import SwiftUI
import SharedKit

// MARK: - Gradient Heatmap View

/// Custom SwiftUI view using Gradient for temperature heatmap visualization
public struct GradientHeatmapView: View {
    let data: [TemperatureDataPoint]
    let height: CGFloat
    let showLabels: Bool

    public init(
        data: [TemperatureDataPoint],
        height: CGFloat = 60,
        showLabels: Bool = true
    ) {
        self.data = data
        self.height = height
        self.showLabels = showLabels
    }

    public var body: some View {
        VStack(spacing: 8) {
            if showLabels {
                header
            }

            heatmap
                .frame(height: height)

            if showLabels {
                footer
            }
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack {
            Text("Temperature")
                .font(.headline)
                .foregroundStyle(.primary)

            Spacer()

            if let minTemp = data.map({ $0.temperature }).min(),
               let maxTemp = data.map({ $0.temperature }).max() {
                HStack(spacing: 4) {
                    Text("\(Int(minTemp.rounded()))°")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Image(systemName: "arrow.left.and.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)

                    Text("\(Int(maxTemp.rounded()))°")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var heatmap: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background gradient
                LinearGradient(
                    stops: gradientStops,
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .cornerRadius(8)

                // Temperature range indicators
                if let minTemp = data.map({ $0.temperature }).min(),
                   let maxTemp = data.map({ $0.temperature }).max(),
                   maxTemp > minTemp {
                    ForEach(data.indices, id: \.self) { index in
                        let point = data[index]
                        if let minRange = point.minTemp,
                           let maxRange = point.maxTemp {
                            rangeIndicator(
                                for: point,
                                minRange: minRange,
                                maxRange: maxRange,
                                globalMin: minTemp,
                                globalMax: maxTemp,
                                index: index,
                                totalCount: data.count,
                                width: geometry.size.width
                            )
                        }
                    }
                }

                // Overlay grid for hours
                if data.count > 1 {
                    HStack(spacing: 0) {
                        ForEach(0..<data.count, id: \.self) { index in
                            Rectangle()
                                .fill(Color.clear)
                                .border(Color.white.opacity(0.1), width: 0.5)
                        }
                    }
                }
            }
        }
    }

    private var footer: some View {
        HStack {
            if let first = data.first {
                Text(first.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            if let last = data.last {
                Text(last.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - Helper Views

    private func rangeIndicator(
        for point: TemperatureDataPoint,
        minRange: Double,
        maxRange: Double,
        globalMin: Double,
        globalMax: Double,
        index: Int,
        totalCount: Int,
        width: CGFloat
    ) -> some View {
        let segmentWidth = width / CGFloat(totalCount)
        let xOffset = CGFloat(index) * segmentWidth

        // Normalize positions to 0-1 range
        let minPosition = normalize(minRange, min: globalMin, max: globalMax)
        let maxPosition = normalize(maxRange, min: globalMin, max: globalMax)

        let barHeight: CGFloat = 4

        return Rectangle()
            .fill(Color.white.opacity(0.6))
            .frame(width: segmentWidth * 0.8, height: barHeight)
            .position(
                x: xOffset + segmentWidth / 2,
                y: height / 2
            )
    }

    // MARK: - Gradient Computation

    private var gradientStops: [Gradient.Stop] {
        guard !data.isEmpty else {
            return [Gradient.Stop(color: .gray, location: 0)]
        }

        let minTemp = data.map({ $0.temperature }).min() ?? 0
        let maxTemp = data.map({ $0.temperature }).max() ?? 1

        guard maxTemp > minTemp else {
            return [Gradient.Stop(color: data.first!.color, location: 0)]
        }

        // Create gradient stops based on data points
        return data.enumerated().map { index, point in
            let location = CGFloat(index) / CGFloat(max(1, data.count - 1))
            return Gradient.Stop(color: point.color, location: location)
        }
    }

    // MARK: - Helpers

    private func normalize(_ value: Double, min: Double, max: Double) -> CGFloat {
        guard max > min else { return 0.5 }
        return CGFloat((value - min) / (max - min))
    }
}

// MARK: - Preview

#Preview {
    let now = Date()
    let sampleData = (0..<24).map { hour in
        let timestamp = now.addingTimeInterval(Double(hour) * 3600)
        let temp = 15.0 + sin(Double(hour) / 24.0 * 2 * .pi) * 10
        return TemperatureDataPoint(
            timestamp: timestamp,
            temperature: temp,
            minTemp: temp - 2,
            maxTemp: temp + 2,
            color: VisualizationTheme.colorForTemperature(temp)
        )
    }

    return VStack(spacing: 20) {
        GradientHeatmapView(data: sampleData)
            .padding()

        GradientHeatmapView(data: Array(sampleData.prefix(12)), height: 40, showLabels: false)
            .padding()
    }
    .background(Color(.systemGroupedBackground))
}
