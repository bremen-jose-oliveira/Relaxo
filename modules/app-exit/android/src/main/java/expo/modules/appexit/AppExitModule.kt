package expo.modules.appexit

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.system.exitProcess

class AppExitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppExit")

    Function("exitApp") {
      val activity = appContext.currentActivity
      activity?.finishAffinity()
      exitProcess(0)
    }
  }
}
