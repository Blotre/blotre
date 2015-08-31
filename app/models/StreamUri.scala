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
    StreamUri(value + StreamUri.sep + child.value.toLowerCase())

  /**
   * Break the Uri into a set of names.
   *
   * Since URIs are lower case, the result may be different in case
   * from the actual stream name displayed.
   */
  def components(): Seq[StreamName] =
    value.split(StreamUri.sep).map(StreamName(_))
}

object StreamUri {
  /**
   * Path component separator.
   */
  val sep = "/"

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
        Some(
          UriEncoding.decodePath(
            uri
              .trim()
              .replace(" ", "+")
              .toLowerCase
              .stripSuffix(StreamUri.sep),
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
    StreamUri(uri.value.toLowerCase().replace(" ", "+"))
}

