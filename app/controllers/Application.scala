package controllers

import java.text.SimpleDateFormat
import java.util.Date
import play.Routes
import play.api.mvc._
import play.core.j.JavaHelpers

import providers.MyUsernamePasswordAuthProvider
import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.user.AuthUser
import scala.concurrent._

/**
 * Main application controller.
 */
object Application extends Controller
{
  /**
   * Get the access token value from a request.
   */
  private def extractAccessTokenFromRequest(request: RequestHeader): Option[String] =
    request.getQueryString("access_token") orElse {
      request.headers.get("Authorization") flatMap { authorization =>
        """Bearer (\w+)""".r.findFirstMatchIn(authorization).map(_.group(1))
      }
    }

  /**
   * Get the valid token from the request.
   */
  def getAccessTokenFromRequest(request: RequestHeader): Option[models.AccessToken] =
    extractAccessTokenFromRequest(request).flatMap(models.AccessToken.findByAccessToken)

  /**
   * Get potentially expired token from request.
   */
  def getAnyAccessTokenFromRequest(request: RequestHeader): Option[models.AccessToken] =
    extractAccessTokenFromRequest(request).flatMap(models.AccessToken.findAnyByAccessToken)

  /**
   * Get the current logged in user for a session.
   */
  def getLocalUser(user: AuthUser): models.User =
    models.User.findByAuthUserIdentity(user).getOrElse(null)

  def getLocalUser(session: play.mvc.Http.Session): models.User =
    getLocalUser(PlayAuthenticate.getUser(session))

  def getLocalUser(request: Request[_]): models.User =
    getLocalUser(JavaHelpers.createJavaContext(request).session())

  def getLocalUser(request: RequestHeader): models.User =
    getLocalUser(JavaHelpers.createJavaContext(request).session())

  /**
   * Get the user that is being acted on behalf of.
   */
  def getTokenUser(request: RequestHeader): Option[models.User] =
    getAccessTokenFromRequest(request).flatMap(_.getUser)

  /**
   * Get the acting user.
   */
  def getActingUser(request: RequestHeader): Option[models.User] =
    getTokenUser(request) orElse (Option(Application.getLocalUser(request)))

  /**
   * Handle trailing slash paths.
   */
  def untrail(path: String) = Action {
    MovedPermanently("/" + path)
  }

  /**
   * Index page.
   *
   * Renders hero page for non logged in users or the users's root stream for logged in users.
   *
   * Redirects to the select user name page if a user has not selected a user name.
   */
  def index = Action.async { implicit request => JavaContext.withContext {
    val localUser = getLocalUser(request)
    if (localUser == null) {
      Future.successful(Ok(views.html.index.render()))
    } else if (localUser.userName == null || localUser.userName.isEmpty()) {
      Future.successful(Redirect(routes.Account.selectUserName()))
    } else {
      controllers.Stream.getStream(localUser.userName).apply(request)
    }
  }}

  def policy = Action { implicit request =>  JavaContext.withContext {
    Ok(views.html.meta.policy.render())
  }}

  /**
   * Login page.
   */
  def login = Action { implicit request => JavaContext.withContext {
    Ok(views.html.login.render(MyUsernamePasswordAuthProvider.LOGIN_FORM))
      .withSession(
        "redirect" -> request.getQueryString("redirect").getOrElse(""))
  }}

  /**
   * Validate that the requested redirect creates a valid url from the request host.
   */
  private def getRedirect(request: RequestHeader, unvalidatedRedirect: String): Option[String] =
    try
    {
      val url = new java.net.URI(
        (if (request.secure) "https://" else "http://")
          + request.host
          + (if (unvalidatedRedirect.startsWith("/")) "" else "/")
          + unvalidatedRedirect)
      Some(url.toString)
    }
    catch
    {
      case e: Exception => None
    }

  /**
   * Post login handler.
   */
  def onLogin = AuthenticatedAction { implicit request =>
    request.session.get("redirect")
      .flatMap(getRedirect(request, _))
      .map { redirect =>
        Redirect(redirect)
      } getOrElse {
        Redirect(routes.Application.index())
      }
  }

  /**
   *
   */
  def notFound = Action { implicit request => JavaContext.withContext {
    NotFound(views.html.notFound.render(""))
  }}

  /**
   *
   */
  def unauthorized = Action { implicit request => JavaContext.withContext {
    Unauthorized(views.html.unauthorized.render(""))
  }}

  def formatTimestamp(t: Long): String =
    new SimpleDateFormat("yyyy-dd-MM HH:mm:ss").format(new Date(t))
}
