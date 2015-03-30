package controllers

import be.objectify.deadbolt.java.actions.SubjectPresent
import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.user.AuthUser
import models.User
import play.core.j.JavaHelpers
import play.data.Form
import play.data.format.Formats.NonEmpty
import play.data.validation.Constraints
import play.data.validation.Constraints.Required
import play.i18n.Messages
import play.libs.Json
import play.api.mvc._
import providers.MyUsernamePasswordAuthProvider
import scala.Option
import play.data.Form.form

object Account extends Controller
{
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

  @SubjectPresent
  def link() = Action { implicit request => JavaContext.withContext {
    //com.feth.play.module.pa.controllers.Authenticate.noCache(response())
    Ok(views.html.account.link.render())
  }}

  @SubjectPresent
  def account() = Action { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    Ok(views.html.account.account.render(localUser))
  }}

  @SubjectPresent
  def askLink() = Action { implicit request => JavaContext.withContext {
    //com.feth.play.module.pa.controllers.Authenticate.noCache(response())
    val u = PlayAuthenticate.getLinkUser(JavaHelpers.createJavaContext(request).session())
    if (u == null)
       Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_link.render(ACCEPT_FORM, u))
  }}

  @SubjectPresent
  def doLink() = Action { implicit request => JavaContext.withContext {
    //com.feth.play.module.pa.controllers.Authenticate.noCache(response())
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
        //if (link) {
        // flash(ApplicationConstants.FLASH_MESSAGE_KEY, Messages.get("playauthenticate.accounts.link.success"))
        //}
        JavaHelpers.createResult(
          ctx,
          PlayAuthenticate.link(ctx, link))
      }
    }
  }}

  @SubjectPresent
  def askMerge() = Action { implicit request => JavaContext.withContext {
    //com.feth.play.module.pa.controllers.Authenticate.noCache(response())
    val aUser = PlayAuthenticate.getUser(JavaHelpers.createJavaContext(request).session())
    val bUser = PlayAuthenticate.getMergeUser(JavaHelpers.createJavaContext(request).session())
    if (bUser == null)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.ask_merge.render(ACCEPT_FORM, aUser, bUser))
  }}

  @SubjectPresent
  def doMerge() = Action { implicit request => JavaContext.withContext {
    //com.feth.play.module.pa.controllers.Authenticate.noCache(response())
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
        //if (merge) {
        // flash(ApplicationConstants.FLASH_MESSAGE_KEY, Messages.get("playauthenticate.accounts.merge.success"))
        //}
        JavaHelpers.createResult(
          ctx,
          PlayAuthenticate.merge(ctx, merge))
      }
    }
  }}

  class UserNameSelect {
    @Required
    @Constraints.Pattern(value = "[a-z0-9\\-_$]+", message = "User name may only contain letters and numbers")
    @Constraints.MinLength(3)
    @Constraints.MaxLength(100)
    var userName: String = _
  }

  private val SELECT_USER_NAME_FORM = form(classOf[UserNameSelect])

  @SubjectPresent
  def selectUserName() = Action { implicit request => JavaContext.withContext {
    val localUser = Application.getLocalUser(request)
    if (localUser.userNameSelected)
      Redirect(routes.Application.index())
    else
      Ok(views.html.account.selectUserName.render(SELECT_USER_NAME_FORM))
  }}

  @SubjectPresent
  def setSelectedUserName() = Action { implicit request => JavaContext.withContext {
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
            User.setUserName(localUser, requestedUserName)
            Redirect(routes.Application.index())
          } getOrElse {
              BadRequest(views.html.account.selectUserName.render(formData))
                .flashing("error" -> "Selected user name could not be processed.")
          }
        }
      }
    }
  }}
}

