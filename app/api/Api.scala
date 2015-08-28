package api

import play.api.data.validation.ValidationError
import play.api.libs.json._

case class ApiError(error: String, details: Option[JsObject] = None)

object ApiError
{
  def apply(error: String, details: JsObject): ApiError =
    new ApiError(error, Some(details))

  def apply(error: String, e: Seq[(JsPath, Seq[ValidationError])]): ApiError =
    ApiError(error, JsError.toJson(e))

  def apply(error: String, e: JsError): ApiError =
    ApiError(error, JsError.toJson(e))


  implicit val apiErrorWrites = new Writes[ApiError] {
    def writes(x: ApiError): JsValue =
      Json.obj(
        "type" -> "Error",
        "error" -> x.error,
        "details" -> x.details)
  }
}

sealed abstract class ApiResult[+T]
{
  def toJson()(implicit writes: Writes[T]): JsValue
}



class ApiSuccess[+T](val value: T) extends ApiResult[T]
{
  def toJson()(implicit writes: Writes[T]) = Json.toJson(value)
}

object ApiSuccess
{
  def unapply[T](t: ApiSuccess[T]): Option[T] = Some(t.value)
}

case class ApiCreated[T](x: T) extends ApiSuccess(x)
case class ApiOk[T](x: T) extends ApiSuccess(x)


class ApiFailure[+T](val value: ApiError) extends ApiResult[T]
{
  def toJson()(implicit writes: Writes[T]) = Json.toJson(value)
}

object ApiFailure
{
  def unapply[T](t: ApiFailure[T]): Option[ApiError] = Some(t.value)
}

case class ApiNotFound(x: ApiError) extends ApiFailure(x)
case class ApiUnauthroized(x: ApiError) extends ApiFailure(x)
case class ApiCouldNotProccessRequest(x: ApiError) extends ApiFailure(x)
case class ApiInternalError() extends ApiFailure(ApiError("An internal server error occured."))


