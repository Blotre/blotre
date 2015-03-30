package controllers

import com.feth.play.module.pa.PlayAuthenticate
import models.TokenAction
import models.TokenAction.Type
import models.User
import play.api.mvc._
import play.data.Form
import play.i18n.Messages
import providers.MyLoginUsernamePasswordAuthUser
import providers.MyUsernamePasswordAuthProvider
import providers.MyUsernamePasswordAuthProvider.MyIdentity
import providers.MyUsernamePasswordAuthUser
import views.html.account.signup.unverified
import views.html.account.signup.no_token_or_invalid
import views.html.account.signup.oAuthDenied
import views.html.account.signup.exists
import controllers.routes
import play.data.Form.form

object Signup extends Controller
{
  import ControllerHelper._

  def unverified() = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.unverified.render())
  }

  private def tokenIsValid(token: String, `type`: Type): TokenAction = {
    var ret: TokenAction = null
    if (token != null && !token.trim().isEmpty) {
      val ta = TokenAction.findByToken(token, `type`)
      if (ta != null && ta.isValid) {
        ret = ta
      }
    }
    ret
  }

  def oAuthDenied(getProviderKey: String) = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.oAuthDenied.render(getProviderKey))
  }

  def exists() = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.exists.render())
  }
}

