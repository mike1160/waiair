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
    .description(String(localized: "home_widget_description"))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}