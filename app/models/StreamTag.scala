package models

import play.api.data.validation.ValidationError
import play.api.libs.json._

/**
 * Valid stream tag.
 */
case class StreamTag(value: String)

object StreamTag {
  private val pattern = """[a-zA-Z0-9_\-$]{1,32}"""

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
    if (trimmed.matches(pattern) && Color.fromString("#" + trimmed).isEmpty)
      Some(StreamTag(trimmed.toLowerCase()))
    else
      None
  }
}