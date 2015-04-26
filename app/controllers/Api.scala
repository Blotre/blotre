package controllers

import play.api.libs.json._
import play.api.data.validation.ValidationError


case class ApiError(error: String, details: Option[JsObject] = None)

object ApiError
{
  def apply(error: String, details: JsObject): ApiError =
    new ApiError(error, Some(details))

  def apply(error: String, e: Seq[(JsPath, Seq[ValidationError])]): ApiError =
    ApiError(error, JsError.toFlatJson(e))

  def apply(error: String, e: JsError): ApiError =
    ApiError(error, JsError.toFlatJson(e))


  implicit val apiErrorWrites = new Writes[ApiError] {
    def writes(x: ApiError): JsValue =
      Json.obj(
        "type" -> "Error",
        "error" -> x.error,
        "details" -> x.details)
  }
}


abstract class ApiResult
{
}

class ApiSuccess(val value: JsValue) extends ApiResult
object ApiSuccess
{
  def unapply(t: ApiSuccess): Option[JsValue] = Some(t.value)
}

case class ApiCreated(x: JsValue) extends ApiSuccess(x)
case class ApiOk(x: JsValue) extends ApiSuccess(x)


class ApiFailure(val value: ApiError) extends ApiResult
object ApiFailure
{
  def unapply(t: ApiFailure): Option[ApiError] = Some(t.value)
}

case class ApiNotFound(x: ApiError) extends ApiFailure(x)
case class ApiUnauthroized(x: ApiError) extends ApiFailure(x)
case class ApiCouldNotProccessRequest(x: ApiError) extends ApiFailure(x)
case class ApiInternalError() extends ApiFailure(ApiError("An internal server error occured."))