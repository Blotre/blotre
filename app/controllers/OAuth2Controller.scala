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
case class TokenResponse(token: models.AccessToken, user: Option[models.User])

object TokenResponse
{
  implicit val tokenResponseWrites = new Writes[TokenResponse] {
    def writes(x: TokenResponse): JsValue =
      Json.obj(
        "access_token" -> x.token.token,
        "token_type" -> "bearer",
        "expires_in" -> x.token.expires,
        "refresh_token" -> x.token.refreshToken,
        "user" -> x.user)
  }
}

/**
 * Token metadata response for /token_info
 */
case class TokenInfo(token: models.AccessToken)

object TokenInfo
{
  import models.Serializable._

  implicit val tokenResponseWrites = new Writes[TokenInfo] {
    def writes(x: TokenInfo): JsValue =
      Json.obj(
        "issued" -> x.token.issued,
        "expires_in" -> x.token.expiresIn(),
        "client_id" -> x.token.clientId,
        "user" -> x.token.getUser)
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
  def authorize(response_type: String, client_id: String) = TryAuthenticateAction { implicit request =>  {
    response_type match {
      case "code" =>
        authorizeAuthorizationCodeFlow(request.user, client_id, request.getQueryString("redirect_uri").getOrElse(""))

      case _ =>
        Ok(views.html.oauth.error.render(Messages.get("blotre.authorize.error.unsupported"), request))
    }
  }}

  /**
   * Start authorization code flow.
   *
   * Displays UI prompting a user to authorize a given client.
   */
  private def authorizeAuthorizationCodeFlow(user: models.User, client_id: String, redirect_uri: String)(implicit request: RequestHeader): Result =
    clientForRedirect(client_id, redirect_uri) map { client =>
      Ok(views.html.oauth.authorize.render("code", client, redirect_uri, request))
    } getOrElse {
      NotFound(views.html.oauth.error.render(Messages.get("blotre.authorize.error.noSuchClient"), request))
    }

  /**
   * Start authorization of a disposable client.
   *
   * Displays UI prompting a user to authorize a the disposable client.
   */
  private def authorizeDisposableFlow(user: models.User, client_id: String, code: String)(implicit request: RequestHeader): Result =
    models.OneTimeCode.findByCode(code) flatMap { code =>
      if (code.clientId == client_id) {
        models.OneTimeClient.findById(code.clientId) flatMap { client =>
          if (client.userId == null)
            Some(Ok(views.html.oauth.authorize.render("disposable", client, code.token, request)))
          else
            None
        }
      } else {
        None
      }
    } getOrElse {
      NotFound(views.html.oauth.error.render(Messages.get("blotre.authorize.error.noSuchClient"), request))
    }

  /**
   * User has authorized or denied the client.
   */
  def onAuthorize() = AuthenticatedAction { implicit request =>  {
    val state = request.getQueryString("state")
    authorizeForm.bindFromRequest.fold(
      formWithErrors =>
        BadRequest,

      value => {
        value.action match {
          case "allow" =>
            authorizeClientForUser(request.user, value.reseponse_type, value.clientId, value.extraData, state)

          case "deny" =>
            denyClientForUser(request.user, value.reseponse_type, value.clientId, value.extraData, state)

          case _ =>
            BadRequest
        }})
  }}

  case class RedeemForm(code: String)

  val redeemForm = Form(mapping(
    "code" -> nonEmptyText
  )(RedeemForm.apply)(RedeemForm.unapply))

  /**
   * Redeem code page
   */
  def redeem() = TryAuthenticateAction { implicit request =>  {
    Ok(views.html.oauth.redeem.render(request))
  }}

  /**
   * Page displayed after a user has successfully redeemed a code.
   */
  def redeemSuccessful() = Action { implicit request =>  {
    Ok(views.html.oauth.redeemSuccessful.render(request))
  }}

  /**
   * Redeem form submission.
   */
  def onRedeem = AuthenticatedAction { implicit request =>  {
    redeemForm.bindFromRequest.fold(
      formWithErrors =>
        Redirect(routes.OAuth2Controller.redeem())
          .flashing("error" -> Messages.get("blotre.redeem.invalidCode")),

      value =>
        models.OneTimeCode.findByCode(value.code) map { code =>
          authorizeDisposableFlow(request.user, code.clientId.toString, code.token)
        } getOrElse {
          Redirect(routes.OAuth2Controller.redeem())
            .flashing("error" -> Messages.get("blotre.redeem.invalidCode"))
        })
  }}

  /**
   * Get metadata about a token.
   */
  def tokenInfo(token: String) = NoCacheAction { implicit request =>
    (models.AccessToken.findByAccessToken(token) orElse models.AccessToken.findByRefreshToken(token)) map { token =>
      Ok(Json.toJson(TokenInfo(token)))
    } getOrElse {
      NotFound(Json.toJson(ApiError("No such token.")))
    }
  }

  /**
   * Revoke a token.
   */
  def revoke(token: String) = NoCacheAction { implicit request =>
    (models.AccessToken.findByAccessToken(token) orElse models.AccessToken.findByRefreshToken(token)) map { token =>
      token.expire()
      Ok("")
    } getOrElse {
      NotFound(Json.toJson(ApiError("No such token.")))
    }
  }

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
  def accessToken = NoCacheAction(parse.urlFormEncoded) { implicit request =>
    request.body.get("client_id").map(_.head) flatMap { client_id =>
      request.body.get("client_secret").map(_.head) map { client_secret =>
        request.body.get("grant_type").map(_.head) match {
          case Some("authorization_code") =>
            accessTokenAuthenticationCode(client_id, client_secret, request.body.get("code").map(_.head).getOrElse(""), request.body.get("redirect_uri").map(_.head).getOrElse(""))

          case Some("refresh_token") =>
            accessTokenRefreshToken(client_id, client_secret, request.body.get("refresh_token").map(_.head).getOrElse(""))

          case Some("https://oauth2grant.blot.re/onetime_code") =>
            accessTokenOneTimeCode(client_id, client_secret, request.body.get("code").map(_.head).getOrElse(""))

          case _ =>
            accessTokenErrorResponse("unsupported_grant_type", "")
        }
      }
    } getOrElse(accessTokenErrorResponse("invalid_grant", ""))
  }

  /**
   * Authentication code based authorization.
   */
  def accessTokenAuthenticationCode(client_id: String, client_secret: String, code: String, redirect_uri: String): Result =
    models.AuthCode.findByCode(code, redirect_uri) flatMap { code =>
      if (code.isExpired() || code.clientId != client_id || code.redirectUri != redirect_uri)
        None
      else
        Some(code)
    } map { code =>
      accessTokenAuthenticationCode(client_id, client_secret, code, redirect_uri)
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  def accessTokenAuthenticationCode(client_id: String, client_secret: String, code: models.AuthCode, redirect_uri: String): Result =
    models.User.findById(code.userId) flatMap { user =>
      models.Client.findByIdAndSecret(client_id, client_secret) map { client =>
        accessTokenAuthenticationCode(user, client, code, redirect_uri)
      }
    } getOrElse (accessTokenErrorResponse("invalid_client", ""))

  def accessTokenAuthenticationCode(user: models.User, client: models.Client, code: models.AuthCode, redirect_uri: String): Result =
    models.AccessToken.refreshAccessToken(client, user, redirect_uri) map { token =>
      code.expire()
      Ok(Json.toJson(TokenResponse(token, token.getUser)))
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

    /**
   * Refresh token based authorization
   */
  def accessTokenRefreshToken(client_id: String, client_secret: String, refresh_token: String): Result =
    models.AccessToken.findByRefreshToken(refresh_token) map { token =>
      accessTokenRefreshToken(client_id, client_secret, token)
    } getOrElse (accessTokenErrorResponse("invalid_grant", ""))

  def accessTokenRefreshToken(client_id: String, client_secret: String, refresh_token: models.AccessToken): Result =
    (if (refresh_token.clientId == client_id)
      (models.Client.findByIdAndSecret(client_id, client_secret) orElse (models.OneTimeClient.findByIdAndSecret(client_id, client_secret))) map { client =>
        accessTokenRefreshToken(client, refresh_token)
      }
    else
      None) getOrElse(accessTokenErrorResponse("invalid_client", ""))

  def accessTokenRefreshToken(client: models.Client, refresh_token: models.AccessToken): Result =
    models.AccessToken.refreshAccessToken(refresh_token) map { updatedToken =>
      Ok(Json.toJson(TokenResponse(updatedToken, updatedToken.getUser)))
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
        Ok(Json.toJson(TokenResponse(token, Some(user))))
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
  private def authorizeClientForUser(user: models.User, response_type: String, clientId: String, redirectUri: String, state: Option[String])(implicit request: RequestHeader): Result =
    response_type match {
      case "code" =>
        authorizeCodeClientForUser(user, clientId, redirectUri, state)

      case "disposable" =>
        authorizeDisposableClientForUser(user, clientId, redirectUri)

      case _ => BadRequest
    }

  /**
   *
   */
  private def authorizeCodeClientForUser(user: models.User, clientId: String, redirectUri: String, state: Option[String]): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      authorizeCodeClientForUser(user, client, redirectUri, state)
    } getOrElse(NotFound)

  private def authorizeCodeClientForUser(user: models.User, client: models.Client, redirectUri: String, state: Option[String]): Result =
    models.AuthCode.refreshAuthCode(client, user, redirectUri) map { code =>
      Redirect(redirectUri, Map(
        "code" -> Seq(code.token),
        "state" -> Seq(state.getOrElse(""))))
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
   * User has denied access to a client.
   */
  private def denyClientForUser(user: models.User, response_type: String, clientId: String, redirectUri: String, state: Option[String])(implicit request: RequestHeader): Result =
    response_type match {
      case "code" =>
        denyAuthorizeCode(user, clientId, redirectUri, state)

      case "disposable" =>
        denyDisposable(user, clientId, redirectUri)

      case _ => BadRequest
    }

  private def denyAuthorizeCode(user: models.User, clientId: String, redirectUri: String, state: Option[String])(implicit request: RequestHeader): Result =
    clientForRedirect(clientId, redirectUri) map { client =>
      Redirect(redirectUri, Map(
        "error" -> Seq("access_denied"),
        "error_description" -> Seq("User rejected access for your application"),
        "state" -> Seq(state.getOrElse(""))))
    } getOrElse {
      NotFound(views.html.oauth.error.render(
        Messages.get("blotre.authorize.error.noSuchClient"),
        request))
    }

  private def denyDisposable(user: models.User,clientId: String, redirectUri: String)(implicit request: RequestHeader): Result =
    Ok(views.html.oauth.error.render(
      Messages.get("blotre.authorize.error.disposableDeny"),
      request))
}