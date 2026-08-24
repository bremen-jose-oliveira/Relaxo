import SwiftUI

@main
struct RelaxoWatchApp: App {
  init() {
    WatchConnectivitySession.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
