import ExpoModulesCore

public class AppExitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppExit")

    Function("exitApp") {
      // Force-quit so an in-progress IPA/APK install can replace this binary.
      exit(0)
    }
  }
}
