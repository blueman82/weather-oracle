import SwiftUI
import SharedKit

// MARK: - Gradient Heatmap View

/// Custom SwiftUI view rendering temperature heatmap with gradient
public struct GradientHeatmapView: View {
    let cells: [[HeatmapCell]]
    let theme: VisualizationTheme
    let showLabels: Bool
    let cellSize: CGFloat

    public init(
        cells: [[HeatmapCell]],
        theme: VisualizationTheme = .default,
        showLabels: Bool = false,
        cellSize: CGFloat = 20
    ) {
        self.cells = cells
        self.theme = theme
        self.showLabels = showLabels
        self.cellSize = cellSize
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Day labels
            if !cells.isEmpty {
                ForEach(0..<cells.count, id: \.self) { rowIndex in
                    heatmapRow(cells[rowIndex], rowIndex: rowIndex)
                }
            }
        }
        .background(theme.backgroundColor)
    }

    // MARK: - Subviews

    private func heatmapRow(_ row: [HeatmapCell], rowIndex: Int) -> some View {
        HStack(spacing: 2) {
            // Day label
            dayLabel(for: rowIndex)
                .frame(width: 60)

            // Hour cells
            ForEach(row) { cell in
                heatmapCell(cell)
            }
        }
    }

    private func dayLabel(for rowIndex: Int) -> some View {
        let calendar = Calendar.current
        let date = calendar.date(byAdding: .day, value: rowIndex, to: Date()) ?? Date()

        return Text(date, format: .dateTime.weekday(.abbreviated))
            .font(.caption2)
            .foregroundStyle(.secondary)
    }

    private func heatmapCell(_ cell: HeatmapCell) -> some View {
        ZStack {
            // Background gradient
            RoundedRectangle(cornerRadius: 2)
                .fill(cell.color)

            // Label overlay
            if showLabels && cell.value != 0 {
                Text(cell.label)
                    .font(.system(size: 8))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: cellSize, height: cellSize)
    }
}

// MARK: - Temperature Gradient Bar

/// Horizontal temperature gradient bar for legend
public struct TemperatureGradientBar: View {
    let minTemp: Double
    let maxTemp: Double
    let theme: VisualizationTheme
    let height: CGFloat

    public init(
        minTemp: Double,
        maxTemp: Double,
        theme: VisualizationTheme = .default,
        height: CGFloat = 20
    ) {
        self.minTemp = minTemp
        self.maxTemp = maxTemp
        self.theme = theme
        self.height = height
    }

    public var body: some View {
        VStack(spacing: 4) {
            // Gradient bar
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    LinearGradient(
                        colors: [
                            theme.coldColor,
                            theme.coolColor,
                            theme.warmColor,
                            theme.hotColor
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: height)

            // Labels
            HStack {
                Text(String(format: "%.0f°", minTemp))
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(String(format: "%.0f°", maxTemp))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Precipitation Gradient Bar

/// Horizontal precipitation gradient bar for legend
public struct PrecipitationGradientBar: View {
    let maxPrecip: Double
    let theme: VisualizationTheme
    let height: CGFloat

    public init(
        maxPrecip: Double,
        theme: VisualizationTheme = .default,
        height: CGFloat = 20
    ) {
        self.maxPrecip = maxPrecip
        self.theme = theme
        self.height = height
    }

    public var body: some View {
        VStack(spacing: 4) {
            // Gradient bar
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    LinearGradient(
                        colors: [
                            theme.dryColor,
                            theme.lightPrecipColor,
                            theme.heavyPrecipColor
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: height)

            // Labels
            HStack {
                Text("0mm")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(String(format: "%.0fmm", maxPrecip))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Preview

#Preview("Gradient Heatmap") {
    let theme = VisualizationTheme.default

    // Mock data
    let cells = (0..<3).map { row in
        (0..<24).map { col in
            let temp = Double.random(in: -5...35)
            return HeatmapCell(
                row: row,
                col: col,
                value: temp,
                color: theme.colorForTemperature(temp),
                label: String(format: "%.0f", temp)
            )
        }
    }

    return ScrollView {
        VStack(spacing: 16) {
            Text("Temperature Heatmap (3 days)")
                .font(.headline)

            GradientHeatmapView(
                cells: cells,
                theme: theme,
                showLabels: false,
                cellSize: 20
            )

            TemperatureGradientBar(
                minTemp: -5,
                maxTemp: 35,
                theme: theme
            )
            .padding(.horizontal)
        }
        .padding()
    }
}
