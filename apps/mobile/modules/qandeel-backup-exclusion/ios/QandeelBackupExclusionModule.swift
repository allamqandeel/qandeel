// S8B-03 (CP2, OD-6, contract §8.2) — the narrow iOS backup exclusion of the Voice Note drafts.
//
// iOS backs up the app's Documents unless an item carries NSURLIsExcludedFromBackupKey; `expo-file-system` offers no
// way to set it, so this module does exactly that and nothing else. A folder's flag covers everything inside it. It
// answers the flag as READ BACK from the file system, so the caller (and the device proof) knows it holds. Nothing is
// logged; a path that does not exist is answered `false`.
import ExpoModulesCore

public class QandeelBackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QandeelBackupExclusion")

    Function("exclude") { (uri: String) -> Bool in
      guard var url = Self.fileUrl(uri), FileManager.default.fileExists(atPath: url.path) else { return false }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
      return Self.isExcluded(url)
    }

    Function("isExcluded") { (uri: String) -> Bool in
      guard let url = Self.fileUrl(uri), FileManager.default.fileExists(atPath: url.path) else { return false }
      return Self.isExcluded(url)
    }
  }

  private static func fileUrl(_ uri: String) -> URL? {
    if let url = URL(string: uri), url.isFileURL { return url }
    return uri.hasPrefix("/") ? URL(fileURLWithPath: uri) : nil
  }

  private static func isExcluded(_ url: URL) -> Bool {
    var fresh = url
    fresh.removeAllCachedResourceValues()
    return (try? fresh.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup) == true
  }
}
