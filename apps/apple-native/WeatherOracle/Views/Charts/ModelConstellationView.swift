import SwiftUI
import SharedKit

// MARK: - Model Constellation View

/// Renders model relationships as constellation using Canvas
public struct ModelConstellationView: View {
    let nodes: [ModelNode]
    let edges: [ModelEdge]
    let theme: VisualizationTheme
    let size: CGSize

    public init(
        nodes: [ModelNode],
        edges: [ModelEdge],
        theme: VisualizationTheme = .default,
        size: CGSize = CGSize(width: 300, height: 300)
    ) {
        self.nodes = nodes
        self.edges = edges
        self.theme = theme
        self.size = size
    }

    public var body: some View {
        Canvas { context, canvasSize in
            // Draw edges first (background layer)
            for edge in edges {
                if let fromNode = nodes.first(where: { $0.model == edge.from }),
                   let toNode = nodes.first(where: { $0.model == edge.to }) {
                    drawEdge(
                        context: context,
                        from: fromNode.position,
                        to: toNode.position,
                        edge: edge
                    )
                }
            }

            // Draw nodes (foreground layer)
            for node in nodes {
                drawNode(context: context, node: node)
            }

            // Draw labels
            for node in nodes {
                drawLabel(context: context, node: node)
            }
        }
        .frame(width: size.width, height: size.height)
        .background(theme.backgroundColor)
    }

    // MARK: - Drawing Functions

    private func drawEdge(
        context: GraphicsContext,
        from: CGPoint,
        to: CGPoint,
        edge: ModelEdge
    ) {
        var path = Path()
        path.move(to: from)
        path.addLine(to: to)

        context.stroke(
            path,
            with: .color(edge.color),
            lineWidth: 1 + (edge.strength * 2)
        )
    }

    private func drawNode(context: GraphicsContext, node: ModelNode) {
        let radius: CGFloat = node.isOutlier ? 12 : 10
        let circle = Circle().path(in: CGRect(
            x: node.position.x - radius,
            y: node.position.y - radius,
            width: radius * 2,
            height: radius * 2
        ))

        // Fill
        context.fill(circle, with: .color(node.color))

        // Stroke
        context.stroke(
            circle,
            with: .color(.white),
            lineWidth: node.isOutlier ? 2 : 1
        )
    }

    private func drawLabel(context: GraphicsContext, node: ModelNode) {
        let labelText = formatModelName(node.model)
        let labelOffset: CGFloat = 20

        // Calculate label position (outside circle)
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let dx = node.position.x - center.x
        let dy = node.position.y - center.y
        let angle = atan2(dy, dx)

        let labelX = node.position.x + cos(angle) * labelOffset
        let labelY = node.position.y + sin(angle) * labelOffset

        // Draw text
        context.draw(
            Text(labelText)
                .font(.caption2)
                .foregroundStyle(node.isOutlier ? theme.outlierColor : .secondary),
            at: CGPoint(x: labelX, y: labelY)
        )
    }

    // MARK: - Helpers

    private func formatModelName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "ARPEGE"
        case .ukmo: return "UKMO"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }
}

// MARK: - Confidence Sparkline

/// Simple sparkline chart for confidence scores
public struct ConfidenceSparklineView: View {
    let dataPoints: [(date: Date, score: Double, color: Color)]
    let theme: VisualizationTheme
    let height: CGFloat

    public init(
        dataPoints: [(date: Date, score: Double, color: Color)],
        theme: VisualizationTheme = .default,
        height: CGFloat = 60
    ) {
        self.dataPoints = dataPoints
        self.theme = theme
        self.height = height
    }

    public var body: some View {
        Canvas { context, size in
            guard !dataPoints.isEmpty else { return }

            let maxScore = 1.0
            let stepX = size.width / CGFloat(max(1, dataPoints.count - 1))

            // Draw line
            var path = Path()
            for (index, point) in dataPoints.enumerated() {
                let x = CGFloat(index) * stepX
                let y = size.height * (1 - CGFloat(point.score / maxScore))

                if index == 0 {
                    path.move(to: CGPoint(x: x, y: y))
                } else {
                    path.addLine(to: CGPoint(x: x, y: y))
                }
            }

            context.stroke(path, with: .color(theme.mediumConfidenceColor), lineWidth: 2)

            // Draw points
            for (index, point) in dataPoints.enumerated() {
                let x = CGFloat(index) * stepX
                let y = size.height * (1 - CGFloat(point.score / maxScore))

                let circle = Circle().path(in: CGRect(
                    x: x - 3,
                    y: y - 3,
                    width: 6,
                    height: 6
                ))

                context.fill(circle, with: .color(point.color))
                context.stroke(circle, with: .color(.white), lineWidth: 1)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Animated Constellation View

/// Constellation view with animated edges
public struct AnimatedConstellationView: View {
    let nodes: [ModelNode]
    let edges: [ModelEdge]
    let theme: VisualizationTheme
    let size: CGSize

    @State private var animationProgress: Double = 0

    public init(
        nodes: [ModelNode],
        edges: [ModelEdge],
        theme: VisualizationTheme = .default,
        size: CGSize = CGSize(width: 300, height: 300)
    ) {
        self.nodes = nodes
        self.edges = edges
        self.theme = theme
        self.size = size
    }

    public var body: some View {
        Canvas { context, canvasSize in
            // Draw animated edges
            for (index, edge) in edges.enumerated() {
                if let fromNode = nodes.first(where: { $0.model == edge.from }),
                   let toNode = nodes.first(where: { $0.model == edge.to }) {

                    let edgeDelay = Double(index) * 0.05
                    let edgeProgress = max(0, min(1, animationProgress - edgeDelay))

                    if edgeProgress > 0 {
                        drawAnimatedEdge(
                            context: context,
                            from: fromNode.position,
                            to: toNode.position,
                            edge: edge,
                            progress: edgeProgress
                        )
                    }
                }
            }

            // Draw nodes
            for node in nodes {
                drawNode(context: context, node: node, scale: animationProgress)
            }

            // Draw labels
            if animationProgress > 0.5 {
                for node in nodes {
                    drawLabel(context: context, node: node, opacity: (animationProgress - 0.5) * 2)
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .background(theme.backgroundColor)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5)) {
                animationProgress = 1.0
            }
        }
    }

    // MARK: - Drawing Functions

    private func drawAnimatedEdge(
        context: GraphicsContext,
        from: CGPoint,
        to: CGPoint,
        edge: ModelEdge,
        progress: Double
    ) {
        let endX = from.x + (to.x - from.x) * progress
        let endY = from.y + (to.y - from.y) * progress

        var path = Path()
        path.move(to: from)
        path.addLine(to: CGPoint(x: endX, y: endY))

        context.stroke(
            path,
            with: .color(edge.color),
            lineWidth: 1 + (edge.strength * 2)
        )
    }

    private func drawNode(context: GraphicsContext, node: ModelNode, scale: Double) {
        let radius: CGFloat = (node.isOutlier ? 12 : 10) * scale
        let circle = Circle().path(in: CGRect(
            x: node.position.x - radius,
            y: node.position.y - radius,
            width: radius * 2,
            height: radius * 2
        ))

        context.fill(circle, with: .color(node.color))
        context.stroke(circle, with: .color(.white), lineWidth: node.isOutlier ? 2 : 1)
    }

    private func drawLabel(context: GraphicsContext, node: ModelNode, opacity: Double) {
        let labelText = formatModelName(node.model)
        let labelOffset: CGFloat = 20

        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let dx = node.position.x - center.x
        let dy = node.position.y - center.y
        let angle = atan2(dy, dx)

        let labelX = node.position.x + cos(angle) * labelOffset
        let labelY = node.position.y + sin(angle) * labelOffset

        context.draw(
            Text(labelText)
                .font(.caption2)
                .foregroundStyle((node.isOutlier ? theme.outlierColor : .secondary).opacity(opacity)),
            at: CGPoint(x: labelX, y: labelY)
        )
    }

    private func formatModelName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "ARPEGE"
        case .ukmo: return "UKMO"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }
}

// MARK: - Preview

#Preview("Model Constellation") {
    let theme = VisualizationTheme.default

    let nodes = [
        ModelNode(model: .ecmwf, position: CGPoint(x: 150, y: 50), isOutlier: false, color: theme.modelNodeColor),
        ModelNode(model: .gfs, position: CGPoint(x: 250, y: 150), isOutlier: true, color: theme.outlierColor),
        ModelNode(model: .icon, position: CGPoint(x: 150, y: 250), isOutlier: false, color: theme.modelNodeColor),
        ModelNode(model: .meteofrance, position: CGPoint(x: 50, y: 150), isOutlier: false, color: theme.modelNodeColor),
    ]

    let edges = [
        ModelEdge(from: .ecmwf, to: .gfs, strength: 0.8, color: theme.modelEdgeColor.opacity(0.8)),
        ModelEdge(from: .ecmwf, to: .icon, strength: 0.9, color: theme.modelEdgeColor.opacity(0.9)),
        ModelEdge(from: .ecmwf, to: .meteofrance, strength: 0.85, color: theme.modelEdgeColor.opacity(0.85)),
        ModelEdge(from: .gfs, to: .icon, strength: 0.3, color: theme.modelEdgeColor.opacity(0.3)),
        ModelEdge(from: .gfs, to: .meteofrance, strength: 0.4, color: theme.modelEdgeColor.opacity(0.4)),
        ModelEdge(from: .icon, to: .meteofrance, strength: 0.95, color: theme.modelEdgeColor.opacity(0.95)),
    ]

    return VStack(spacing: 24) {
        Text("Model Constellation")
            .font(.headline)

        ModelConstellationView(
            nodes: nodes,
            edges: edges,
            theme: theme,
            size: CGSize(width: 300, height: 300)
        )

        Text("GFS is an outlier (orange)")
            .font(.caption)
            .foregroundStyle(.secondary)

        Divider()

        Text("Animated Constellation")
            .font(.headline)

        AnimatedConstellationView(
            nodes: nodes,
            edges: edges,
            theme: theme,
            size: CGSize(width: 300, height: 300)
        )
    }
    .padding()
}
