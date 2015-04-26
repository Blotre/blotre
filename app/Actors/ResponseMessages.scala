package Actors

import play.api.libs.json._

/**
 * Current stream status response.
 */
case class CurrentStatusResponse(uri: String, status: models.Status)

object CurrentStatusResponse
{
  implicit val statusWrites = new Writes[CurrentStatusResponse] {
    def writes(x: CurrentStatusResponse): JsValue =
      Json.obj(
        "type" -> "StreamStatus",
        "from" -> x.uri,
        "status" -> x.status)
  }
}
