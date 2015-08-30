package api.socket

import play.api.libs.json._


/**
 * Stream response.
 */
case class StreamResponse(stream: models.Stream, correlation: Int)

object StreamResponse {
  implicit val statusWrites = new Writes[StreamResponse] {
    def writes(x: StreamResponse): JsValue =
      Json.obj(
        "type" -> "Stream",
        "correlation" -> x.correlation) ++ Json.toJson(x.stream).as[JsObject]
  }
}

/**
 * Current stream status response.
 */
case class CurrentStatusResponse(uri: String, status: models.Status, correlation: Int)

object CurrentStatusResponse
{
  implicit val statusWrites = new Writes[CurrentStatusResponse] {
    def writes(x: CurrentStatusResponse): JsValue =
      Json.obj(
        "type" -> "StreamStatus",
        "url" -> x.uri,
        "status" -> x.status,
        "correlation" -> x.correlation)
  }
}

/**
 * Current stream children response.
 */
case class ApiChildrenResponse(uri: String, children: Seq[models.Stream], correlation: Int)

object ApiChildrenResponse
{
  implicit val statusWrites = new Writes[ApiChildrenResponse] {
    def writes(x: ApiChildrenResponse): JsValue =
      Json.obj(
        "type" -> "StreamChildren",
        "url" -> x.uri,
        "children" -> x.children,
        "correlation" -> x.correlation)
  }
}

/**
 * Websocket error response message.
 */
case class SocketError(error: String, correlation: Int)

object SocketError
{
  implicit val statusWrites = new Writes[SocketError] {
    def writes(x: SocketError): JsValue =
      Json.obj(
        "type" -> "Error",
        "error" -> x.error,
        "correlation" -> x.correlation)
  }
}

/**
 * Stream tag response.
 */
case class StreamTagResponse(tags: Seq[models.StreamTag], correlation: Int)

object StreamTagResponse {
  implicit val statusWrites = new Writes[StreamTagResponse] {
    def writes(x: StreamTagResponse): JsValue =
      Json.obj(
        "type" -> "StreamTags",
        "tags" -> x.tags,
        "correlation" -> x.correlation)
  }
}