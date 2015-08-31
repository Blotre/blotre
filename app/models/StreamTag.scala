package models

import play.api.data.validation.ValidationError
import play.api.libs.json._

/**
 * Valid stream tag.
 */
case class StreamTag(value: String)

object StreamTag {
  val pattern = ("(?![a-fA-F0-9]{6}$)" + StreamName.validCharacter + "{1,32}").r

  implicit val writes = new Writes[StreamTag] {
    def writes(x: StreamTag): JsValue =
      Json.obj(
        "tag" -> x.value)
  }

  implicit val reads: Reads[models.StreamTag] =
    (__ \  "tag").read[String]
      .map(fromString)
      .filter(ValidationError("Tag is not valid."))(_.isDefined)
      .map(_.get)

  def fromString(name: String): Option[StreamTag] = {
    val trimmed = name.trim()
    if (trimmed.matches(pattern.toString))
      Some(StreamTag(trimmed.toLowerCase()))
    else
      None
  }
}