package controllers

import play.api.mvc._
import scalaoauth2.provider._
import oauth.MyDataHandler
import scala.concurrent.ExecutionContext.Implicits.global

object OAuth2Controller extends Controller with OAuth2Provider
{
  /**
   *
   */
  def authorize = Action { implicit request => JavaContext.withContext {
    val client_id = request.getQueryString("client_id").getOrElse("")
    val redirect_uri = request.getQueryString("redirect_uri").getOrElse("").stripSuffix("/")
    clientForRedirect(client_id, redirect_uri) map { client =>
      Option(Application.getLocalUser(request)) map { user =>
        models.AccessToken.findToken(client.id, user) match {
          case Some(_) =>
           // models.AccessToken.updateAccessToken(client.id, user)
            Redirect(redirect_uri + "?code=" )

          case None => Ok(views.html.oauth.authorize.render(client))
        }

      } getOrElse(Redirect(
        routes.Application.login.absoluteURL(request.secure),
        Map("redirect" -> List(request.path + "?" + request.rawQueryString)),
        302))
    } getOrElse(BadRequest)
  }}

  /**
   *
   */
  def accessToken = Action.async { implicit request =>
    issueAccessToken(new MyDataHandler())
  }

  /**
   * Lookup a given client by id and validate the requested redirect is valid.
   */
  private def clientForRedirect(clientId: String, redirect: String) =
    models.Client.findById(clientId) flatMap { client =>
      models.Client.validateRedirect(client, redirect)
    }
}