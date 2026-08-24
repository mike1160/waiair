import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct FlightHomeWidget: Widget {
  let name: String = "FlightHomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("WaiAir")
    .description("Your next tracked flight on the Home Screen.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}