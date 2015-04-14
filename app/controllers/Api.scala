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