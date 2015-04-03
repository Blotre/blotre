package controllers

import play.api.data.Form
import play.api.data.Forms._
import play.api.mvc._
import scala.concurrent.ExecutionContext.Implicits.global

object OAuth2Controller extends Controller
{
  case class AuthorizeForm(clientId: String, redirectUri: String)

   val authorizeForm = Form(mapping(
    "client_id" -> nonEmptyText,
    "redirect_uri" ->  nonEmptyText
  )(AuthorizeForm.apply)(AuthorizeForm.unapply))

  /**
   * OAuth authorization page.
   */
  def authorize(response_type: String, client_id: String, redirect_uri: String) = Action { implicit request => JavaContext.withContext {
    response_type match {
      case "code" => {
        clientForRedirect(client_id, redirect_uri) map { client =>
          Option(Application.getLocalUser(request)) map { user =>
            models.AuthCode.findByClient(client, user) match {
              case Some(_) =>
                authorizeClientForUser(client, redirect_uri, user)

              case None =>
                Ok(views.html.oauth.authorize.render(client, redirect_uri))
            }
          } getOrElse {
            Redirect(
              routes.Application.login.absoluteURL(request.secure),
              Map("redirect" -> Seq(request.path + "?" + request.rawQueryString)),
              302)
          }
        } getOrElse(NotFound)
      }

      case _ => NotImplemented
    }
  }}


  def onAuthorize = AuthenticatedAction { implicit request => JavaContext.withContext {
    var user = Application.getLocalUser(request)
    request.body.asFormUrlEncoded.get("action").headOption match {
      case Some("allow") =>
        authorizeForm.bindFromRequest.fold(
          formWithErrors =>
            BadRequest,

          value => 
            authorizeClientForUser(value.clientId, value.redirectUri, user))

      case Some("deny") =>
        Ok("Cliked remove")

      case _ =>
        BadRequest
    }
  }}

  /**
   *
   */
  def accessToken = Action { implicit request =>
   Ok("")
  }

  /**
   * Lookup a given client by id and validate the requested redirect is valid.
   */
  private def clientForRedirect(clientId: String, redirect: String) =
    models.Client.findById(clientId) flatMap { client =>
      models.Client.validateRedirect(client, redirect)
    }

  private def authorizeClientForUser(clientId: String, redirectUri: String, user: models.User): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      authorizeClientForUser(client, redirectUri, user)
    } getOrElse(NotFound)

  private def authorizeClientForUser(client: models.Client, redirectUri: String, user: models.User): Result =
    models.AuthCode.refreshAuthCode(client, user) map { code =>
      Redirect(redirectUri, Map(
        "code" -> Seq(code.code)))
    } getOrElse(BadRequest)
}