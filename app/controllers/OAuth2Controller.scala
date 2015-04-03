package controllers

import play.api.data.Form
import play.api.data.Forms._
import play.api.libs.json._
import play.api.mvc._
import scala.concurrent.ExecutionContext.Implicits.global

object OAuth2Controller extends Controller
{
  case class AuthorizeForm(action: String, clientId: String, redirectUri: String)

   val authorizeForm = Form(mapping(
      "action" -> nonEmptyText,
      "client_id" -> nonEmptyText,
      "redirect_uri" ->  nonEmptyText
    )(AuthorizeForm.apply)(AuthorizeForm.unapply))

  /**
   * OAuth authorization page.
   */
  def authorize(response_type: String, client_id: String, redirect_uri: String) = TryAuthenticateAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    response_type match {
      case "code" =>
        authorizeAuthorizationCodeFlow(user, response_type, client_id, redirect_uri)

      case _ => NotImplemented
    }
  }}

  /**
   * Start an authorization code based flow.
   *
   * Displays authorization UI or if previously authenticated, updates the authenitcation.
   */
  private def authorizeAuthorizationCodeFlow(user: models.User, response_type: String, client_id: String, redirect_uri: String): Result = {
    clientForRedirect(client_id, redirect_uri) map { client =>
      models.AuthCode.findByClient(client, user) match {
        case Some(_) =>
          authorizeClientForUser(client, redirect_uri, user)

        case None =>
          Ok(views.html.oauth.authorize.render(client, redirect_uri))
      }
    } getOrElse(NotFound)
  }

  /**
   *
   */
  def onAuthorize = AuthenticatedAction { implicit request => JavaContext.withContext {
    var user = Application.getLocalUser(request)
    authorizeForm.bindFromRequest.fold(
      formWithErrors =>
        BadRequest,

      value => {
        val clientId = value.clientId
        val redirectUri = value.redirectUri
        value.action match {
          case "allow" =>
            authorizeClientForUser(clientId, redirectUri, user)

          case "deny" =>
            denyClientForUser(clientId, redirectUri, user)

          case _ =>
            BadRequest
        }})
  }}

  /**
   * TODO: check redirect_uri
   */
  def accessToken(grant_type: String, client_id: String, client_secret: String, code: String) = Action { implicit request =>
    grant_type match {
      case "authorization_code" =>
        models.AuthCode.findByCode(code) flatMap { code =>
          if (code.isExpired() || code.clientId != client_id)
            None
          else
            Some(code)
        } map { code =>
          val user = models.User.findById(code.userId).get
          models.Client.findById(client_id) flatMap { client =>
            if (client.validateCreds(client_secret))
              Some(client)
            else
              None
          } flatMap { client =>
            models.AccessToken.refreshAccessToken(client, user)
          } map { token =>
            Ok(Json.obj(
              "access_token" -> token.accessToken,
              "token_type" -> "bearer",
              "expires_in" -> token.expires
            ))
          } getOrElse(accessTokenErrorResponse("invalid_client", ""))

        } getOrElse(accessTokenErrorResponse("invalid_grant", ""))

      case _ =>
        accessTokenErrorResponse("unsupported_grant_type", "")
    }
  }

  def accessTokenErrorResponse(error: String, errorDescription: String): Result =
    BadRequest(Json.obj(
      "error" -> error,
      "error_description" -> errorDescription
    ))


  /**
   * Lookup a given client by id and validate the requested redirect is valid.
   */
  private def clientForRedirect(clientId: String, redirect: String) =
    models.Client.findById(clientId) flatMap { client =>
      models.Client.validateRedirect(client, redirect)
    }

  /**
   *
   */
  private def authorizeClientForUser(clientId: String, redirectUri: String, user: models.User): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      authorizeClientForUser(client, redirectUri, user)
    } getOrElse(NotFound)

  private def authorizeClientForUser(client: models.Client, redirectUri: String, user: models.User): Result =
    models.AuthCode.refreshAuthCode(client, user) map { code =>
      Redirect(redirectUri, Map(
        "code" -> Seq(code.code)))
    } getOrElse(BadRequest)

  /**
   *
   */
  private def denyClientForUser(clientId: String, redirectUri: String, user: models.User): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      Redirect(redirectUri, Map(
        "error" -> Seq("access_denied"),
        "error_description" -> Seq("User rejected access for your application")))
    } getOrElse(BadRequest)
}