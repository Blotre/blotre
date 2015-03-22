package helper

import play.api.mvc.RequestHeader

/**
 *
 */
case class PrefersMime(mimeType: String) {
  /**
   * Don't use `request.accepts` to avoid accepting `* / *`.
   */
  def unapply(request: RequestHeader): Boolean =
    request.headers.get("accept") == Some(mimeType)
}

/**
 * 
 */
case class PrefersExtOrMime(ext: String, mimeType: String) {
  /**
   * Don't use `request.accepts` to avoid accepting `* / *`.
   */
  def unapply(request: RequestHeader): Boolean =
    PrefersMime(mimeType).unapply(request) || request.path.endsWith("." + ext)
}

/**
 *
 */
object Prefers {
  val Json = PrefersMime("application/json")
}


