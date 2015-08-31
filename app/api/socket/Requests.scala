package api.socket

import api.ApiSetStatusData
import play.api.libs.json.{JsPath, Reads}
import play.api.libs.functional.syntax._

/**
 *
 */
case class GetStreams(query: Option[String], limit: Option[Int], offset: Option[Int])

object GetStreams {
  implicit val reads: Reads[GetStreams] = (
    (JsPath \ "query").readNullable[String] and
      (JsPath \ "limit").readNullable[Int] and
      (JsPath \ "offset").readNullable[Int]
    )(GetStreams.apply _)
}

/**
 *
 */
case class GetStream(uri: String)

object GetStream {
  implicit val reads: Reads[GetStream] =
    (JsPath \ "uri").read[String].map(GetStream.apply)
}

/**
 *
 */
case class DeleteStream(uri: String)

object DeleteStream {
  implicit val reads: Reads[DeleteStream] =
    (JsPath \ "uri").read[String].map(DeleteStream.apply)
}

/**
 *
 */
case class GetStatus(of: String)

object GetStatus {
  implicit val reads: Reads[GetStatus] =
    (JsPath \ "of").read[String].map(GetStatus.apply)
}

/**
 *
 */
case class SetStatus(of: String, status: ApiSetStatusData)

object SetStatus {
  implicit val reads: Reads[SetStatus] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "status").read[ApiSetStatusData]
    )(SetStatus.apply _)
}

/**
 *
 */
case class GetTags(of: String)

object GetTags {
  implicit val reads: Reads[GetTags] =
    (JsPath \ "of").read[String].map(GetTags.apply)
}

/**
 *
 */
case class SetTags(of: String, tags: api.ApiSetTagsData)

object SetTags {
  implicit val reads: Reads[SetTags] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "tags").read[api.ApiSetTagsData]
    )(SetTags.apply _)
}

/**
 *
 */
case class GetTag(of: String, tag: String)

object GetTag {
  implicit val reads: Reads[GetTag] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "tag").read[String]
    )(GetTag.apply _)
}

/**
 *
 */
case class SetTag(of: String, tag: String)

object SetTag {
  implicit val reads: Reads[SetTag] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "tag").read[String]
    )(SetTag.apply _)
}

/**
 *
 */
case class DeleteTag(of: String, tag: String)

object DeleteTag {
  implicit val reads: Reads[DeleteTag] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "tag").read[String]
    )(DeleteTag.apply _)
}

/**
 *
 */
case class GetChild(of: String, child: String)

object GetChild {
  implicit val socketApiGetChildrenReads: Reads[GetChild] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "child").read[String]
    )(GetChild.apply _)
}

/**
 *
 */
case class DeleteChild(of: String, child: String)

object DeleteChild {
  implicit val socketApiGetChildrenReads: Reads[DeleteChild] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "child").read[String]
    )(DeleteChild.apply _)
}

/**
 *
 */
case class CreateChild(of: String, child: String)

object CreateChild {
  implicit val socketApiGetChildrenReads: Reads[CreateChild] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "child").read[String]
    )(CreateChild.apply _)
}

/**
 *
 */
case class GetChildren(of: String, query: Option[String], limit: Option[Int], offset: Option[Int])

object GetChildren {
  implicit val socketApiGetChildrenReads: Reads[GetChildren] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "query").readNullable[String] and
      (JsPath \ "limit").readNullable[Int] and
      (JsPath \ "offset").readNullable[Int]
    )(GetChildren.apply _)
}

/**
 *
 */
case class Subscribe(to: List[String])

object Subscribe {
  implicit val reads: Reads[Subscribe] =
    (JsPath \ "to").read[List[String]].map(Subscribe.apply)
}

/**
 *
 */
case class SubscribeCollection(to: String)

object SubscribeCollection {
  implicit val reads: Reads[SubscribeCollection] =
    (JsPath \ "to").read[String].map(SubscribeCollection.apply)
}
