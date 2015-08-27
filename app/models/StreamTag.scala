package models

import play.api.libs.json._

/**
 * Valid stream tag.
 */
case class StreamTag(value: String)

object StreamTag
{
  val pattern = ("(?![a-fA-F0-9]{6}$)" + StreamName.validCharacter + "{1,32}").r

  implicit val streamWrites = new Writes[StreamTag] {
    def writes(x: StreamTag): JsValue = Json.toJson(x.value)
  }

  def fromString(name: String): Option[StreamTag] = {
    val trimmed = name.trim()
    if (trimmed.matches(pattern.toString))
      Some(StreamTag(trimmed))
    else
      None
  }
}