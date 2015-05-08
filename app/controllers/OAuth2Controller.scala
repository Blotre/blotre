package controllers

import play.api.data.Form
import play.api.data.Forms._
import play.api.libs.json._
import play.api.mvc._
import play.i18n.Messages
import scala.concurrent.ExecutionContext.Implicits.global

object OAuth2Controller extends Controller
{
  import models.Serializable._

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

      case _ =>
        Ok(views.html.oauth.error.render(Messages.get("blotre.authorize.error.unsupported")))
    }
  }}

  /**
   * Start an authorization code based flow.
   *
   * Displays authorization UI or if previously authenticated, updates the authentication.
   */
  private def authorizeAuthorizationCodeFlow(user: models.User, response_type: String, client_id: String, redirect_uri: String): Result =
    clientForRedirect(client_id, redirect_uri) map { client =>
      models.AuthCode.findByClient(client, user, redirect_uri) match {
        case Some(_) =>
          authorizeClientForUser(user, client, redirect_uri)

        case None =>
          Ok(views.html.oauth.authorize.render(client, redirect_uri))
      }
    } getOrElse(NotFound)

  /**
   * User has authorized of denied client.
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
            authorizeClientForUser(user, clientId, redirectUri)

          case "deny" =>
            denyClientForUser(user, clientId, redirectUri)

          case _ =>
            BadRequest
        }})
  }}

  /**
   *
   */
  def redeem = TryAuthenticateAction { implicit request => JavaContext.withContext {
    Ok(views.html.oauth.redeem.render())
  }}

  case class RedeemForm(code: String)

  val redeemForm = Form(mapping(
    "code" -> nonEmptyText
  )(RedeemForm.apply)(RedeemForm.unapply))

  def onRedeem = NoCacheAction { implicit request => JavaContext.withContext {
    redeemForm.bindFromRequest.fold(
      formWithErrors =>
        BadRequest,

      value => {
        models.OneTimeCode.findByCode(value.code) map { code =>
          Ok("")
        } getOrElse {
          Redirect(routes.OAuth2Controller.redeem())
            .flashing("error" -> Messages.get("blotre.redeem.invalidCode"))
        }
      })
  }}

  /**
   *
   */
  def createCode(client_id: String, client_secret: String) = NoCacheAction {
    models.Client.findByIdAndSecret(client_id, client_secret) map { client =>
       models.OneTimeCode.generateOneTimeCode(client) map { code =>
         Ok(Json.obj(
          "code" -> code.token))
       } getOrElse (InternalServerError)
    } getOrElse (NotFound)
  }

  /**
   *
   */
  def accessToken(grant_type: String, client_id: String, client_secret: String, code: String, redirect_uri: String) = NoCacheAction { implicit request =>
    grant_type match {
      case "authorization_code" =>
        accessTokenAuthenticationCode(client_id, client_secret, code, redirect_uri)
      case _ =>
        accessTokenErrorResponse("unsupported_grant_type", "")
    }
  }

  /**
   * Authentication code based authorization.
   */
  def accessTokenAuthenticationCode(client_id: String, client_secret: String, code: String, redirect_uri: String) =
    models.AuthCode.findByCode(code, redirect_uri) flatMap { code =>
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
        models.AccessToken.refreshAccessToken(client, user, redirect_uri)
      } map { token =>
        Ok(Json.obj(
          "access_token" -> token.token,
          "token_type" -> "bearer",
          "expires_in" -> token.expires,
          "user" -> Json.obj(
            "id" -> Json.toJson(token.userId))
        ))
      } getOrElse (accessTokenErrorResponse("invalid_client", ""))
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  /**
   *
   */
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
  private def authorizeClientForUser(user: models.User, clientId: String, redirectUri: String): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      authorizeClientForUser(user, client, redirectUri)
    } getOrElse(NotFound)

  private def authorizeClientForUser(user: models.User, client: models.Client, redirectUri: String): Result =
    models.AuthCode.refreshAuthCode(client, user, redirectUri) map { code =>
      Redirect(redirectUri, Map(
        "code" -> Seq(code.token)))
    } getOrElse(BadRequest)

  /**
   *
   */
  private def denyClientForUser(user: models.User, clientId: String, redirectUri: String): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      Redirect(redirectUri, Map(
        "error" -> Seq("access_denied"),
        "error_description" -> Seq("User rejected access for your application")))
    } getOrElse(BadRequest)
}