package controllers

import play.api.mvc.Security.AuthenticatedBuilder
import play.api.mvc._
import play.api.libs.json._
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

case class AuthRequest[A](user: models.User, request: Request[A]) extends WrappedRequest[A](request)

/**
 * Action that requires a user to be logged in.
 *
 * Throws up a 401 if no user is logged in.
 */
object AuthenticatedAction extends AuthenticatedBuilder(
  request =>
    Option(Application.getLocalUser(request)),
  implicit request =>
      Results.Unauthorized(views.html.unauthorized.render(request)))

/**
 * Authenticate
 */
case class Authenticated[A](action: Action[A]) extends Action[A]
{
  def apply(request: Request[A]): Future[Result] =
    Option(Application.getLocalUser(request)) map { user =>
      action(AuthRequest(user, request))
    } getOrElse {
      Future.successful(Results.Unauthorized(views.html.unauthorized.render(request)))
    }

  lazy val parser = action.parser
}

/**
 * Action that requires a user to be logged in.
 *
 * Redirects to a login page if the user is not logged in.
 */
object TryAuthenticateAction extends AuthenticatedBuilder(
  request =>
    Option(Application.getLocalUser(request)),
  implicit request =>
    Results.Redirect(
      routes.Application.login.absoluteURL(request.secure),
      Map("redirect" -> Seq(request.path + "?" + request.rawQueryString)),
      302))


/**
 * Action that that requires an active user or client acting on behalf
 * of a user.
 *
 * Sets a special `WWW-Authenticate` response to indicate when the access token has expired.
 */
object AuthorizedAction extends AuthenticatedBuilder(
  Application.getActingUser,
  implicit request => {
    import ApiError._
    Application.getAnyAccessTokenFromRequest(request).filter(_.isExpired) map { _ =>
      Results.Unauthorized(Json.toJson(ApiError("Access token is expired.")))
        .withHeaders("WWW-Authenticate" -> """Bearer error="invalid_token" error_description="Access token is expired"""")
    } getOrElse {
      Results.Unauthorized(Json.toJson(ApiError("Action requires authorization.")))
    }})