package controllers

import com.feth.play.module.pa.PlayAuthenticate
import play.api.data.Form
import play.api.data.Forms._
import play.api.mvc._
import play.core.j.JavaHelpers
import play.i18n.Messages


case class UserNameSelectForm(userName: String)

case class AcceptForm(accept: Boolean)

object Account extends Controller
{
  import ControllerHelper._

  private val acceptForm = Form(mapping(
    "accept" -> boolean
  )(AcceptForm.apply)(AcceptForm.unapply))


  def link() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    Ok(views.html.account.link.render(request.user))
  }}}

  def account() = AuthenticatedAction { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    Ok(views.html.account.account.render(localUser))
  }}

  def askLink() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val u = PlayAuthenticate.getLinkUser(JavaHelpers.createJavaContext(request).session())
    if (u == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_link.render(acceptForm, u))
  }}}

  def doLink() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val ctx = JavaHelpers.createJavaContext(request)
    val u = PlayAuthenticate.getLinkUser(ctx.session())
    if (u == null) {
      Redirect(routes.Application.index())
    } else {
      acceptForm.bindFromRequest().fold(
        formWithErrors =>
          BadRequest(views.html.account.ask_link.render(formWithErrors, u)),

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

  def askMerge() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(JavaHelpers.createJavaContext(request).session())
    if (bUser == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_merge.render(acceptForm, aUser, bUser))
  }}}

  def doMerge() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val ctx = JavaHelpers.createJavaContext(request)

    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(ctx.session())
    if (bUser == null) {
      Redirect(routes.Application.index())
    } else {
      acceptForm.bindFromRequest().fold(
        formWithErrors =>
          BadRequest(views.html.account.ask_merge.render(formWithErrors, aUser, bUser)),

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
    "userName" ->  nonEmptyText(3, 100)
      .verifying("Sorry, your user name may only contain letters and numbers", name => name.matches(models.User.userNamePattern.toString))
      .verifying("Sorry, that name is already taken", name => models.Stream.findByUri(name).isEmpty)
  )(UserNameSelectForm.apply)(UserNameSelectForm.unapply))

  def selectUserName() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.selectUserName.render(userNameSelectForm))
  }}}

  def setSelectedUserName() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected) {
      Redirect(routes.Application.index())
    } else {
     userNameSelectForm.bindFromRequest().fold(
       formWithErrors =>
        BadRequest(views.html.account.selectUserName.render(formWithErrors))
          .flashing("error" -> "Please correct errors."),

      values => {
        val requestedUserName = values.userName
        models.Stream.createRootStream(requestedUserName, localUser) map { rootStream =>
          models.User.setUserName(localUser, requestedUserName)
          Redirect(routes.Application.index())
        } getOrElse {
          BadRequest(views.html.account.selectUserName.render(userNameSelectForm))
            .flashing("error" -> "Could not process request.")
        }
      })
    }
  }}}
}

