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
  def create(uri: models.StreamUri): StreamAddress =
    StreamAddress(uri)

  def create(stream: models.Stream): StreamAddress =
    create(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def create(tag: models.StreamTag): TagAddress =
    TagAddress(tag)

  /**
   * Attempt to create an address from user input
   */
  def fromUser(input: String): Option[Address] =
    if (input.startsWith("#")) {
      models.StreamTag.fromString(input.substring(1)).map(create(_))
    } else {
      models.StreamUri.fromString(input).map(create(_))
    }
}