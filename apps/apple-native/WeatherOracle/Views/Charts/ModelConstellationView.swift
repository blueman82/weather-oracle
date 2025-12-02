import SwiftUI
import SharedKit

// MARK: - Model Constellation View

/// Renders model relationships as constellation (nodes and edges) with deterministic layout
public struct ModelConstellationView: View {
    let nodes: [ModelNode]
    let edges: [ModelEdge]
    let size: CGSize
    let showLabels: Bool

    public init(
        nodes: [ModelNode],
        edges: [ModelEdge],
        size: CGSize = CGSize(width: 300, height: 300),
        showLabels: Bool = true
    ) {
        self.nodes = nodes
        self.edges = edges
        self.size = size
        self.showLabels = showLabels
    }

    public var body: some View {
        VStack(spacing: 12) {
            if showLabels {
                header
            }

            constellation
                .frame(width: size.width, height: size.height)

            if showLabels {
                legend
            }
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack {
            Text("Model Agreement")
                .font(.headline)
                .foregroundStyle(.primary)

            Spacer()

            let agreementCount = nodes.filter { !$0.isOutlier }.count
            let totalCount = nodes.count

            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.green)

                Text("\(agreementCount)/\(totalCount)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var constellation: some View {
        Canvas { context, size in
            // Draw edges first (behind nodes)
            for edge in edges {
                guard let fromNode = nodes.first(where: { $0.model == edge.from }),
                      let toNode = nodes.first(where: { $0.model == edge.to }) else {
                    continue
                }

                drawEdge(
                    context: context,
                    from: fromNode.position,
                    to: toNode.position,
                    strength: edge.strength
                )
            }

            // Draw nodes on top
            for node in nodes {
                drawNode(
                    context: context,
                    node: node
                )
            }

            // Draw labels if enabled
            if showLabels {
                for node in nodes {
                    drawLabel(
                        context: context,
                        node: node
                    )
                }
            }
        }
    }

    private var legend: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(nodes) { node in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(node.color)
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .strokeBorder(
                                        node.isOutlier ? Color.red : Color.clear,
                                        lineWidth: 2
                                    )
                            )

                        Text(modelName(node.model))
                            .font(.caption)
                            .foregroundStyle(node.isOutlier ? .secondary : .primary)

                        if node.isOutlier {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Canvas Drawing

    private func drawEdge(
        context: GraphicsContext,
        from: CGPoint,
        to: CGPoint,
        strength: Double
    ) {
        var path = Path()
        path.move(to: from)
        path.addLine(to: to)

        // Edge opacity based on strength
        let opacity = 0.1 + strength * 0.3

        context.stroke(
            path,
            with: .color(.white.opacity(opacity)),
            lineWidth: strength > 0.5 ? 2 : 1
        )
    }

    private func drawNode(
        context: GraphicsContext,
        node: ModelNode
    ) {
        let radius: CGFloat = node.isOutlier ? 16 : 14

        // Draw node circle
        let circle = Path(ellipseIn: CGRect(
            x: node.position.x - radius,
            y: node.position.y - radius,
            width: radius * 2,
            height: radius * 2
        ))

        context.fill(circle, with: .color(node.color))

        // Draw border for outliers
        if node.isOutlier {
            context.stroke(
                circle,
                with: .color(.red),
                lineWidth: 2
            )
        } else {
            context.stroke(
                circle,
                with: .color(.white.opacity(0.5)),
                lineWidth: 1
            )
        }

        // Draw glow effect for non-outliers
        if !node.isOutlier {
            let glowCircle = Path(ellipseIn: CGRect(
                x: node.position.x - radius - 3,
                y: node.position.y - radius - 3,
                width: (radius + 3) * 2,
                height: (radius + 3) * 2
            ))

            context.stroke(
                glowCircle,
                with: .color(node.color.opacity(0.3)),
                lineWidth: 2
            )
        }
    }

    private func drawLabel(
        context: GraphicsContext,
        node: ModelNode
    ) {
        let name = modelAbbreviation(node.model)
        let labelOffset: CGFloat = node.isOutlier ? 24 : 22

        let text = Text(name)
            .font(.caption2)
            .bold()
            .foregroundStyle(node.isOutlier ? .red : .white)

        context.draw(
            text,
            at: CGPoint(
                x: node.position.x,
                y: node.position.y + labelOffset
            )
        )
    }

    // MARK: - Helpers

    private func modelName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "Météo-France"
        case .ukmo: return "UK Met"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }

    private func modelAbbreviation(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "EC"
        case .gfs: return "GFS"
        case .icon: return "ICN"
        case .meteofrance: return "ARG"
        case .ukmo: return "UK"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }
}

// MARK: - Preview

#Preview {
    let sampleNodes = [
        ModelNode(
            model: .ecmwf,
            position: CGPoint(x: 150, y: 50),
            color: VisualizationTheme.colorForModel(.ecmwf),
            isOutlier: false
        ),
        ModelNode(
            model: .gfs,
            position: CGPoint(x: 250, y: 120),
            color: VisualizationTheme.colorForModel(.gfs),
            isOutlier: false
        ),
        ModelNode(
            model: .icon,
            position: CGPoint(x: 230, y: 230),
            color: VisualizationTheme.colorForModel(.icon),
            isOutlier: false
        ),
        ModelNode(
            model: .meteofrance,
            position: CGPoint(x: 100, y: 250),
            color: VisualizationTheme.colorForModel(.meteofrance),
            isOutlier: true
        ),
        ModelNode(
            model: .ukmo,
            position: CGPoint(x: 50, y: 150),
            color: VisualizationTheme.colorForModel(.ukmo),
            isOutlier: false
        )
    ]

    let sampleEdges = [
        ModelEdge(from: .ecmwf, to: .gfs, strength: 0.8),
        ModelEdge(from: .ecmwf, to: .icon, strength: 0.8),
        ModelEdge(from: .ecmwf, to: .ukmo, strength: 0.8),
        ModelEdge(from: .gfs, to: .icon, strength: 0.8),
        ModelEdge(from: .gfs, to: .ukmo, strength: 0.8),
        ModelEdge(from: .icon, to: .ukmo, strength: 0.8),
        ModelEdge(from: .ecmwf, to: .meteofrance, strength: 0.2),
        ModelEdge(from: .gfs, to: .meteofrance, strength: 0.2),
        ModelEdge(from: .icon, to: .meteofrance, strength: 0.2),
        ModelEdge(from: .ukmo, to: .meteofrance, strength: 0.2)
    ]

    return VStack(spacing: 30) {
        ModelConstellationView(
            nodes: sampleNodes,
            edges: sampleEdges
        )
        .padding()
        .background(Color.black.opacity(0.8))
        .cornerRadius(12)

        ModelConstellationView(
            nodes: sampleNodes,
            edges: sampleEdges,
            size: CGSize(width: 200, height: 200),
            showLabels: false
        )
        .padding()
        .background(Color.black.opacity(0.8))
        .cornerRadius(12)
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
