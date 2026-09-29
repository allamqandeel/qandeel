package expo.modules.qandeelappappearance

import android.app.UiModeManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * W3-01 — the Android application night mode, set to the reader's QANDEEL appearance (P1 §12).
 *
 * `UiModeManager.setApplicationNightMode` (API 31+) "sets and persists" the night mode for this application
 * until the app changes it, its data is cleared or it is uninstalled; the system reads it for the next cold
 * launch's splash, so a saved preference is not contradicted before the app can run. It needs no permission.
 *
 * The app-level meaning of each mode is the platform service's, not the constant's prose: AOSP
 * `UiModeManagerService.setApplicationNightMode` maps YES -> `UI_MODE_NIGHT_YES`, NO -> `UI_MODE_NIGHT_NO`,
 * and every other accepted mode, AUTO included, -> `UI_MODE_NIGHT_UNDEFINED` — no per-app override, so the
 * app follows the system appearance. Hence Dark -> YES, Light -> NO, System -> AUTO.
 *
 * Below API 31 there is nothing to persist, and the call reports false. Nothing is logged.
 */
class QandeelAppAppearanceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QandeelAppAppearance")

    Function("setApplicationNightMode") { preference: String ->
      val mode = when (preference) {
        "DARK" -> UiModeManager.MODE_NIGHT_YES
        "LIGHT" -> UiModeManager.MODE_NIGHT_NO
        "SYSTEM" -> UiModeManager.MODE_NIGHT_AUTO
        else -> throw IllegalArgumentException("unknown appearance preference")
      }
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      val context = appContext.reactContext ?: return@Function false
      val uiModeManager = context.getSystemService(UiModeManager::class.java) ?: return@Function false
      uiModeManager.setApplicationNightMode(mode)
      true
    }
  }
}
