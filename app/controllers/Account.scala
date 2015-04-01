package controllers

import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.user.AuthUser
import play.core.j.JavaHelpers
import play.data.Form
import play.data.format.Formats.NonEmpty
import play.data.validation.Constraints
import play.data.validation.Constraints.Required
import play.i18n.Messages
import play.libs.Json
import play.api.mvc._
import scala.Option
import play.data.Form.form

object Account extends Controller
{
  import ControllerHelper._

  class Accept {
    @Required
    @NonEmpty
    var accept: java.lang.Boolean = _

    def getAccept(): java.lang.Boolean = accept

    def setAccept(accept: java.lang.Boolean) {
      this.accept = accept
    }
  }

  private val ACCEPT_FORM = form(classOf[Accept])

  def link() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    Ok(views.html.account.link.render())
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
      Ok(views.html.account.ask_link.render(ACCEPT_FORM, u))
  }}}

  def doLink() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val ctx = JavaHelpers.createJavaContext(request)
    val u = PlayAuthenticate.getLinkUser(ctx.session())
    if (u == null) {
      Redirect(routes.Application.index())
    } else {
      val filledForm = ACCEPT_FORM.bindFromRequest()
      if (filledForm.hasErrors()) {
        BadRequest(views.html.account.ask_link.render(filledForm, u))
      } else {
        val link = filledForm.get.accept
        val result = JavaHelpers.createResult(ctx, PlayAuthenticate.link(ctx, link))
        if (link)
          result.flashing(ApplicationConstants.FLASH_MESSAGE_KEY -> Messages.get("playauthenticate.accounts.link.success"))
        else
          result
      }
    }
  }}}

  def askMerge() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(JavaHelpers.createJavaContext(request).session())
    if (bUser == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_merge.render(ACCEPT_FORM, aUser, bUser))
  }}}

  def doMerge() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val ctx = JavaHelpers.createJavaContext(request)

    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(ctx.session())
    if (bUser == null) {
      Redirect(routes.Application.index())
    } else {
      val filledForm = ACCEPT_FORM.bindFromRequest()
      if (filledForm.hasErrors()) {
        BadRequest(views.html.account.ask_merge.render(filledForm, aUser, bUser))
      } else {
        val merge = filledForm.get.accept
        val result = JavaHelpers.createResult(ctx, PlayAuthenticate.merge(ctx, merge))
        if (merge)
          result
            .flashing(ApplicationConstants.FLASH_MESSAGE_KEY -> Messages.get("playauthenticate.accounts.merge.success"))
        else
          result
      }
    }
  }}}

  class UserNameSelect {
    @Required
    @Constraints.Pattern(value = "[a-z0-9\\-_$]+", message = "User name may only contain letters and numbers")
    @Constraints.MinLength(3)
    @Constraints.MaxLength(100)
    var userName: String = _
  }

  private val SELECT_USER_NAME_FORM = form(classOf[UserNameSelect])

  def selectUserName() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.selectUserName.render(SELECT_USER_NAME_FORM))
  }}}

  def setSelectedUserName() = NoCache { AuthenticatedAction { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected) {
      Redirect(routes.Application.index())
    } else {
      val formData = Form.form(classOf[UserNameSelect]).bindFromRequest()
      if (formData.hasErrors()) {
        BadRequest(views.html.account.selectUserName.render(formData))
          .flashing("error" -> "Please correct errors.")
      } else {
        val requestedUserName = formData.get.userName
        models.Stream.findByUri(requestedUserName) map { existing =>
          BadRequest(views.html.account.selectUserName.render(formData))
            .flashing("error" -> "User name already taken.")
        } getOrElse {
          models.Stream.createRootStream(requestedUserName, localUser) map { rootStream =>
            models.User.setUserName(localUser, requestedUserName)
            Redirect(routes.Application.index())
          } getOrElse {
            BadRequest(views.html.account.selectUserName.render(formData))
              .flashing("error" -> "Selected user name could not be processed.")
          }
        }
      }
    }
  }}}
}

