package Actors

import play.api.libs.json.{Json, JsValue, Writes}

/**
 * User facing name used to identify streams.
 */
abstract class Address {
  val value: String
}

case class StreamAddress(uri: models.StreamUri) extends Address {
  val value = uri.value
}

case class TagAddress(tag: models.StreamTag) extends Address {
  val value = "#" + tag.value
}

object Address {
  implicit val writes = new Writes[Address] {
    def writes(x: Address): JsValue = Json.toJson(x.value)
  }

  /**
   * Get the topic of a stream.
   */
  def forStream(uri: models.StreamUri): StreamAddress =
    StreamAddress(uri)

  def forStream(stream: models.Stream): StreamAddress =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): TagAddress =
    TagAddress(tag)
}