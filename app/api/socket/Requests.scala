package api.socket

import api.ApiSetStatusData
import play.api.libs.json.{JsPath, Reads}
import play.api.libs.functional.syntax._

/**
 *
 */
case class SocketApiGetStreams(query: Option[String], limit: Option[Int], offset: Option[Int])

object SocketApiGetStreams
{
  implicit val socketApiGetStreamsReasds: Reads[SocketApiGetStreams] = (
    (JsPath \ "query").readNullable[String] and
      (JsPath \ "limit").readNullable[Int] and
      (JsPath \ "offset").readNullable[Int]
    )(SocketApiGetStreams.apply _)
}

/**
 *
 */
case class SocketApiGetStream(uri: String)

object SocketApiGetStream
{
  implicit val socketApiGetStreamReads: Reads[SocketApiGetStream] =
    (JsPath \ "uri").read[String].map(SocketApiGetStream.apply)
}

/**
 *
 */
case class SocketApiDeleteStream(uri: String)

object SocketApiDeleteStream
{
  implicit val socketApiDeleteStreamReads: Reads[SocketApiDeleteStream] =
    (JsPath \ "uri").read[String].map(SocketApiDeleteStream.apply)
}

/**
 *
 */
case class SocketApiGetStatus(of: String)

object SocketApiGetStatus
{
  implicit val socketApiGetStatusReads: Reads[SocketApiGetStatus] =
    (JsPath \ "of").read[String].map(SocketApiGetStatus.apply)
}

/**
 *
 */
case class SocketApiGetChildren(of: String, query: Option[String], limit: Option[Int], offset: Option[Int])

object SocketApiGetChildren
{
  implicit val socketApiGetChildrenReads: Reads[SocketApiGetChildren] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "query").readNullable[String] and
      (JsPath \ "limit").readNullable[Int] and
      (JsPath \ "offset").readNullable[Int]
    )(SocketApiGetChildren.apply _)
}

/**
 *
 */
case class SocketApiSetStatus(of: String, status: ApiSetStatusData)

object SocketApiSetStatus
{
  implicit val socketApiSetStatusReads: Reads[SocketApiSetStatus] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "status").read[ApiSetStatusData]
    )(SocketApiSetStatus.apply _)
}

/**
 *
 */
case class SocketApiSubscribe(to: List[String])

object SocketApiSubscribe
{
  implicit val socketApiSubscribeReads: Reads[SocketApiSubscribe] =
    (JsPath \ "to").read[List[String]].map(SocketApiSubscribe.apply)
}

/**
 *
 */
case class SocketApiSubscribeCollection(to: String)

object SocketApiSubscribeCollection
{
  implicit val socketApiSubscribeCollectionReads: Reads[SocketApiSubscribeCollection] =
    (JsPath \ "to").read[String].map(SocketApiSubscribeCollection.apply)
}
