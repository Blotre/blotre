package controllers

import play.api.mvc._

object ControllerHelper
{
  def noCache(result: Result) =
    result.withHeaders(
      "Cache-Control" -> "no-cache, no-store, must-revalidate",
      "Expires" -> "0")

  def NoCacheAction(f: Request[AnyContent] => Result): Action[AnyContent] = Action { request =>
    noCache(f(request))
  }
}
