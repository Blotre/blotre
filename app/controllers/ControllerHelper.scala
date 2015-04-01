package controllers

import play.api.mvc._

import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

object ControllerHelper
{
  def noCache(result: Result) =
    result.withHeaders(
      "Cache-Control" -> "no-cache, no-store, must-revalidate",
      "Expires" -> "0")
}

/**
 * No cache action
 */
object NoCacheAction extends ActionBuilder[Request]
{
  def invokeBlock[A](request: Request[A], block: (Request[A]) => Future[Result]) =
    block(request).map(ControllerHelper.noCache)
}

/**
 * No cache compose action.
 */
case class NoCache[A](action: Action[A]) extends Action[A]
{
  def apply(request: Request[A]): Future[Result] =
    action(request).map(ControllerHelper.noCache)

  lazy val parser = action.parser
}
