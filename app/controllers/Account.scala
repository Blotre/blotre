package controllers

import com.feth.play.module.pa.PlayAuthenticate
import play.api.data.Form
import play.api.data.Forms._
import play.api.libs.json.Json
import play.api.mvc._
import play.core.j.JavaHelpers
import play.i18n.Messages


case class UserNameSelectForm(userName: String)

case class AcceptForm(accept: Boolean)

/**
 * User account controller.
 */
object Account extends Controller
{
  import models.Serializable._

  private val acceptForm = Form(mapping(
    "accept" -> boolean
  )(AcceptForm.apply)(AcceptForm.unapply))

  /**
   * Display the user's profile page.
   */
  def account() = AuthenticatedAction { implicit request =>  {
    Ok(views.html.account.account.render(request.user, request))
  }}

  def link() = NoCache { AuthenticatedAction { implicit request => {
    Ok(views.html.account.link.render(request.user, request))
  }}}

  def askLink() = NoCache { AuthenticatedAction { implicit request => {
    val u = PlayAuthenticate.getLinkUser(JavaHelpers.createJavaContext(request).session())
    if (u == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_link.render(acceptForm, u, request))
  }}}

  def doLink() = NoCache { AuthenticatedAction { implicit request =>  {
    val ctx = JavaHelpers.createJavaContext(request)
    val u = PlayAuthenticate.getLinkUser(ctx.session())
    if (u == null) {
      Redirect(routes.Application.index())
    } else {
      acceptForm.bindFromRequest().fold(
        formWithErrors =>
          BadRequest(views.html.account.ask_link.render(formWithErrors, u, request)),

        values => {
          val link = values.accept
          val result = JavaHelpers.createResult(ctx, PlayAuthenticate.link(ctx, link))
          if (link)
            result.flashing(ApplicationConstants.FLASH_MESSAGE_KEY -> Messages.get("playauthenticate.accounts.link.success"))
          else
            result
        })
    }
  }}}

  def askMerge() = NoCache { AuthenticatedAction { implicit request =>  {
    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(JavaHelpers.createJavaContext(request).session())
    if (bUser == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_merge.render(acceptForm, aUser, bUser, request))
  }}}

  def doMerge() = NoCache { AuthenticatedAction { implicit request =>  {
    val ctx = JavaHelpers.createJavaContext(request)

    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(ctx.session())
    if (bUser == null) {
      Redirect(routes.Application.index())
    } else {
      acceptForm.bindFromRequest().fold(
        formWithErrors =>
          BadRequest(views.html.account.ask_merge.render(formWithErrors, aUser, bUser, request)),

      values => {
        val merge = values.accept
        val result = JavaHelpers.createResult(ctx, PlayAuthenticate.merge(ctx, merge))
        if (merge)
          result
            .flashing(ApplicationConstants.FLASH_MESSAGE_KEY -> Messages.get("playauthenticate.accounts.merge.success"))
        else
          result
      })
    }
  }}}

  val userNameSelectForm = Form(mapping(
    "userName" ->  nonEmptyText(3, 64)
      .verifying(Messages.get("blotre.account.selectUserName.invalid"), name => models.User.toValidUsername(name).isDefined)
      .verifying(Messages.get("blotre.account.selectUserName.token"), name => models.Stream.findByUri(name).isEmpty)
  )(UserNameSelectForm.apply)(UserNameSelectForm.unapply))

  /**
   * Display a form allowing the current user to select their user name.
   */
  def selectUserName() = NoCache { AuthenticatedAction { implicit request =>  {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.selectUserName.render(userNameSelectForm, request))
  }}}

  /**
   * Form submission for user name selection.
   */
  def setSelectedUserName() = NoCache { AuthenticatedAction { implicit request =>  {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected) {
      Redirect(routes.Application.index())
    } else {
     userNameSelectForm.bindFromRequest().fold(
       formWithErrors =>
        BadRequest(views.html.account.selectUserName.render(formWithErrors, request))
          .flashing("error" -> "Please correct errors."),

      values => {
        models.Stream.toValidStreamName(values.userName) flatMap { validatedName =>
          models.Stream.createRootStream(validatedName, localUser) map { rootStream =>
            models.User.setUserName(localUser, validatedName.value)
            Redirect(routes.Application.index())
          }
        } getOrElse {
          BadRequest(views.html.account.selectUserName.render(userNameSelectForm, request))
            .flashing("error" -> "Could not process request.")
        }
      })
    }
  }}}

  /**
   * Display all valid authorizations for the current user.
   */
  def authorizations() = NoCache { AuthenticatedAction { implicit request =>
    render {
      case Accepts.Html() =>
         {
          Ok(views.html.account.authorizations.render(request))
        }

      case Accepts.Json() =>
        renderAuthorizationsJson(request.user)
    }
  }}

  def renderAuthorizationsJson(user: models.User) =
    Ok(Json.toJson(
      models.AccessToken.findForUser(user) map { token =>
        val client = (models.Client.findById(token.clientId) orElse models.OneTimeClient.findById(token.clientId)).get
        Json.obj(
          "clientId" -> client.id,
          "clientName" -> client.name,
          "clientBlurb" -> client.blurb,
          "issued" -> token.issued)
      }))

  /**
   * Revoke an access token for the current user for a given client.
   */
  def revokeAuthorization(clientId: String) = NoCache { AuthenticatedAction { implicit request =>
    models.AccessToken.findToken(clientId, request.user) map { token =>
      token.expire()
      Ok("")
    } getOrElse (NotFound)
  }}
}

