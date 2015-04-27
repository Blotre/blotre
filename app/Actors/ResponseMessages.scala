package Actors

import play.api.libs.json._

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
        "from" -> x.uri,
        "status" -> x.status,
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
 *  Websocket success response message.
 *
 *  Used to indicate that an operation without an response body has completed successfully.
 */
case class SocketSuccess(correlation: Int)

object SocketSuccess
{
  implicit val statusWrites = new Writes[SocketSuccess] {
    def writes(x: SocketSuccess): JsValue =
      Json.obj(
        "type" -> "Success",
        "correlation" -> x.correlation)
  }
}
