package api

import play.api.data.validation.ValidationError
import play.api.libs.json._
import play.api.libs.functional.syntax._

/**
  *
  */
case class ApiSetStatusData(color: models.Color)

object ApiSetStatusData {
  implicit val apiSetStatusDataReads: Reads[ApiSetStatusData] =
    (__ \ "color")
      .read(models.Color.readColor)
      .map(ApiSetStatusData.apply(_))
}

/**
  *
  */
case class ApiSetTagsData(tags: Seq[models.StreamTag])

object ApiSetTagsData {
  implicit val apiSetStatusDataReads: Reads[ApiSetTagsData] =
    Reads.list[models.StreamTag]
      .filter(ValidationError("Too many tags."))(tags => tags.size <= models.Stream.maxTags)
      .filter(ValidationError("Duplicate tags not allowed."))(tags => tags.distinct.size == tags.size)
      .map(ApiSetTagsData(_))
}

/**
  *
  */
case class ApiCreateStreamData(name: String, uri: String, status: Option[ApiSetStatusData], tags: Option[ApiSetTagsData])

object ApiCreateStreamData {
  implicit val apiCreateStreamDataReads: Reads[ApiCreateStreamData] = (
    (JsPath \ "name").read[String] and
      (JsPath \ "uri").read[String] and
      (JsPath \ "status").readNullable[ApiSetStatusData] and
      (JsPath \ "tags").readNullable[ApiSetTagsData]
    ) (ApiCreateStreamData.apply _)
}
