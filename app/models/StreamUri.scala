package models

import play.api.libs.json.{Json, JsValue, Writes}
import play.utils.UriEncoding

/**
 * Valid stream uri.
 */
case class StreamUri(value: String)
{
  /**
   * Add a path segment to the stream uri.
   */
  def addPath(child: StreamName): StreamUri  =
    StreamUri(value + "/" + child.value)
}

object StreamUri
{
  implicit val streamWrites = new Writes[StreamUri] {
    def writes(x: StreamUri): JsValue = Json.toJson(x.value)
  }

  /**
   * Create a stream uri from a string.
   */
  def fromString(uri: String): Option[StreamUri] =
    try
      if (uri == null)
        None
      else {
        Some(UriEncoding.decodePath(uri
          .trim()
          .replace(" ", "+")
          .toLowerCase
          .stripSuffix("/"),
          "UTF-8"))
          .filterNot(_.isEmpty)
          .map(StreamUri(_))
      }
    catch {
      case e: Throwable =>
        None
    }

  /**
   * Create a stream uri from a name.
   *
   * Names are subsets of uris.
   */
  def fromName(uri: StreamName): StreamUri  =
    StreamUri(uri.value)
}

