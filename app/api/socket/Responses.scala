package api.socket

import play.api.libs.json._


/**
 * Single stream response.
 */
case class StreamResponse(stream: models.Stream, correlation: Int)

object StreamResponse {
  implicit val writes = new Writes[StreamResponse] {
    def writes(x: StreamResponse): JsValue =
      Json.obj(
        "type" -> "Stream",
        "correlation" -> x.correlation) ++ Json.toJson(x.stream).as[JsObject]
  }
}

/**
 * Multiple stream response.
 */
case class StreamsResponse(streams: Seq[models.Stream], correlation: Int)

object StreamsResponse {
  implicit val statusWrites = new Writes[StreamsResponse] {
    def writes(x: StreamsResponse): JsValue =
      Json.obj(
        "type" -> "Streams",
        "streams" -> x.streams,
        "correlation" -> x.correlation)
  }
}

/**
 * Current stream status response.
 */
case class StreamStatusResponse(uri: String, status: models.Status, correlation: Int)

object StreamStatusResponse {
  implicit val writes = new Writes[StreamStatusResponse] {
    def writes(x: StreamStatusResponse): JsValue =
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

object ApiChildrenResponse {
  implicit val writes = new Writes[ApiChildrenResponse] {
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

object SocketError {
  implicit val writes = new Writes[SocketError] {
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
  implicit val writes = new Writes[StreamTagResponse] {
    def writes(x: StreamTagResponse): JsValue =
      Json.obj(
        "type" -> "StreamTags",
        "tags" -> x.tags,
        "correlation" -> x.correlation)
  }
}