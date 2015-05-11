package controllers

import controllers.Stream._
import play.api.data.Form
import play.api.data.Forms._
import play.api.data.validation.ValidationError
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.mvc._
import play.i18n.Messages
import scala.concurrent.ExecutionContext.Implicits.global


case class DisposableClientInfo(name: String, blurb: String)

object DisposableClientInfo
{
  def nameValidate = Reads.StringReads.filter(ValidationError("Name is not valid."))(x => x.length >= 3 && x.length < 255)

  implicit val apiCreateStreamDataReads: Reads[DisposableClientInfo] = (
    (JsPath \ "name").read[String](nameValidate) and
      (JsPath \ "blurb").read[String]
    )(DisposableClientInfo.apply _)
}

/**
 *
 */
case class TokenResponse(token: models.AccessToken)

object TokenResponse
{
  import models.Serializable._

  implicit val tokenResponseWrites = new Writes[TokenResponse] {
    def writes(x: TokenResponse): JsValue =
      Json.obj(
        "access_token" -> x.token.token,
        "token_type" -> "bearer",
        "expires_in" -> x.token.expires,
        "refresh_token" -> x.token.refreshToken,
        "user" -> Json.obj(
          "id" -> x.token.userId))
  }
}

/**
 *
 */
object OAuth2Controller extends Controller
{
  import models.Serializable._

  case class AuthorizeForm(reseponse_type: String, action: String, clientId: String, extraData: String)

   val authorizeForm = Form(mapping(
      "response_type" -> nonEmptyText,
      "action" -> nonEmptyText,
      "client_id" -> nonEmptyText,
      "extra_data" ->  nonEmptyText
    )(AuthorizeForm.apply)(AuthorizeForm.unapply))

  /**
   * OAuth authorization page.
   */
  def authorize(response_type: String, client_id: String) = TryAuthenticateAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    response_type match {
      case "code" =>
        authorizeAuthorizationCodeFlow(user, client_id, request.getQueryString("redirect_uri").getOrElse(""))

      case "disposable" =>
        authorizeDisposableFlow(user, client_id, request.getQueryString("onetime_code").getOrElse(""))

      case _ =>
        Ok(views.html.oauth.error.render(Messages.get("blotre.authorize.error.unsupported")))
    }
  }}

  /**
   * Start an authorization code based flow.
   *
   * Displays authorization UI or if previously authenticated, updates the authentication.
   */
  private def authorizeAuthorizationCodeFlow(user: models.User, client_id: String, redirect_uri: String): Result =
    clientForRedirect(client_id, redirect_uri) map { client =>
      Ok(views.html.oauth.authorize.render("code", client, redirect_uri))
    } getOrElse(NotFound)

  private def authorizeDisposableFlow(user: models.User, client_id: String, code: String): Result =
    models.OneTimeCode.findByCode(code) flatMap { code =>
      if (code.clientId == client_id) {
        models.OneTimeClient.findById(code.clientId) flatMap { client =>
          if (client.userId == null)
            Some(Ok(views.html.oauth.authorize.render("disposable", client, code.token)))
          else
            None
        }
      } else {
        None
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
        value.action match {
          case "allow" =>
            authorizeClientForUser(user, value.reseponse_type, value.clientId, value.extraData)

          case "deny" =>
            denyClientForUser(user, value.reseponse_type, value.clientId, value.extraData)

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

  def redeemSuccessful = Action { implicit request => JavaContext.withContext {
    Ok(views.html.oauth.redeemSuccessful.render())
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
          Redirect(routes.OAuth2Controller.authorize("disposable", code.clientId.toString).url, Map("onetime_code" -> Seq(code.token)))
        } getOrElse {
          Redirect(routes.OAuth2Controller.redeem())
            .flashing("error" -> Messages.get("blotre.redeem.invalidCode"))
        }
      })
  }}

  /**
   *
   */
  def createDisposableClient() = NoCacheAction(parse.json) { implicit request =>
    (Json.fromJson[DisposableClientInfo](request.body)).fold(
      valid = value => {
        models.OneTimeClient.createClient(value.name, "", value.blurb) flatMap { newClient =>
          models.OneTimeCode.generateOneTimeCode(newClient) map { code =>
            Ok(Json.obj(
              "name" -> newClient.name,
              "blurb" -> newClient.blurb,
              "id" -> newClient.id,
              "secret" -> newClient.clientSecret,
              "code" -> code.token,
              "expires_in" -> code.expires))
          }
        } getOrElse {
          BadRequest(Json.toJson(ApiError("Could not process request")))
        }
      },
      invalid = e =>
        BadRequest(Json.toJson(ApiError("Could not process request", e))))
  }

  /**
   *
   */
  def accessToken(grant_type: String, client_id: String, client_secret: String) = NoCacheAction { implicit request =>
    grant_type match {
      case "authorization_code" =>
        accessTokenAuthenticationCode(client_id, client_secret, request.getQueryString("code").getOrElse(""), request.getQueryString("redirect_uri").getOrElse(""))

      case "refresh_token" =>
        accessTokenRefreshToken(client_id, client_secret, request.getQueryString("refresh_token").getOrElse(""), request.getQueryString("redirect_uri").getOrElse(""))

      case "https://oauth2grant.blot.re/onetime_code" =>
        accessTokenOneTimeCode(client_id, client_secret, request.getQueryString("code").getOrElse(""))

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
      models.Client.findByIdAndSecret(client_id, client_secret) flatMap { client =>
        if (client.validateCreds(client_secret))
          Some(client)
        else
          None
      } flatMap { client =>
        models.AccessToken.refreshAccessToken(client, user, redirect_uri)
      } map { token =>
        code.expire()
        Ok(Json.toJson(TokenResponse(token)))
      } getOrElse (accessTokenErrorResponse("invalid_client", ""))
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  /**
   * Refresh token based authorization
   */
  def accessTokenRefreshToken(client_id: String, client_secret: String, redirect_uri:String, refresh_token: String): Result =
    models.AccessToken.findByRefreshToken(refresh_token) map { token =>
      accessTokenRefreshToken(client_id, client_secret, redirect_uri, token)
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  def accessTokenRefreshToken(client_id: String, client_secret: String, redirect_uri:String, refresh_token: models.AccessToken): Result =
    (if (refresh_token.clientId == client_id && refresh_token.redirectUri == redirect_uri)
      models.Client.findByIdAndSecret(client_id, client_secret) map { client =>
        accessTokenRefreshToken(client, redirect_uri, refresh_token)
      }
    else
      None) getOrElse(accessTokenErrorResponse("invalid_client", ""))

  def accessTokenRefreshToken(client: models.Client, redirect_uri: String, refresh_token: models.AccessToken): Result =
    models.AccessToken.refreshAccessToken(refresh_token) map { updatedToken =>
      Ok(Json.toJson(TokenResponse(updatedToken)))
    } getOrElse (accessTokenErrorResponse("invalid_client", ""))

  /**
   * One time code code based authorization.
   */
  def accessTokenOneTimeCode(client_id: String, client_secret: String, code: String): Result  =
    models.OneTimeCode.findByCode(code) flatMap { code =>
      if (code.clientId != client_id)
        None
      else
        Some(code)
    } map { code =>
      accessTokenOneTimeCode(client_id, client_secret, code)
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  def accessTokenOneTimeCode(client_id: String, client_secret: String, code: models.OneTimeCode): Result =
    models.OneTimeClient.findByIdAndSecret(client_id, client_secret) map { client =>
      accessTokenOneTimeCode(client, code)
    } getOrElse (accessTokenErrorResponse("invalid_client", ""))

  def accessTokenOneTimeCode(client: models.OneTimeClient, code: models.OneTimeCode): Result =
    models.User.findById(client.userId) flatMap { user =>
      models.AccessToken.refreshAccessToken(client, user, "") map { token =>
        code.expire()
        Ok(Json.toJson(TokenResponse(token)))
      }
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  /**
   *
   */
  private def accessTokenErrorResponse(error: String, errorDescription: String): Result =
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
  private def authorizeClientForUser(user: models.User, response_type: String, clientId: String, redirectUri: String): Result =
    response_type match {
      case "code" =>
        authorizeCodeClientForUser(user, clientId, redirectUri)

      case "disposable" =>
        authorizeDisposableClientForUser(user, clientId, redirectUri)

      case _ => BadRequest
    }

  /**
   *
   */
  private def authorizeCodeClientForUser(user: models.User, clientId: String, redirectUri: String): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      authorizeCodeClientForUser(user, client, redirectUri)
    } getOrElse(NotFound)

  private def authorizeCodeClientForUser(user: models.User, client: models.Client, redirectUri: String): Result =
    models.AuthCode.refreshAuthCode(client, user, redirectUri) map { code =>
      Redirect(redirectUri, Map(
        "code" -> Seq(code.token)))
    } getOrElse(BadRequest)

  /**
   *
   */
  private def authorizeDisposableClientForUser(user: models.User, clientId: String, code: String): Result =
    models.OneTimeCode.findByCode(code) map { code =>
      authorizeDisposableClientForUser(user, clientId, code)
    } getOrElse(NotFound)

  private def authorizeDisposableClientForUser(user: models.User, clientId: String, code: models.OneTimeCode): Result =
    if (code.clientId == clientId) {
      models.OneTimeClient.findById(code.clientId) map { client =>
        authorizeDisposableClientForUser(user, client, code)
      } getOrElse(NotFound)
    } else {
      NotFound
    }

  private def authorizeDisposableClientForUser(user: models.User, client: models.OneTimeClient, code: models.OneTimeCode): Result =
    if (client.userId == null) {
      models.AccessToken.refreshAccessToken(client, user, "")
      models.OneTimeClient.setUser(client, user)
      Redirect(routes.OAuth2Controller.redeemSuccessful)
    } else {
      NotFound
    }

  /**
   *
   */
  private def denyClientForUser(user: models.User, response_type: String, clientId: String, redirectUri: String): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      Redirect(redirectUri, Map(
        "error" -> Seq("access_denied"),
        "error_description" -> Seq("User rejected access for your application")))
    } getOrElse(BadRequest)
}