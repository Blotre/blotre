package controllers

import com.feth.play.module.pa.PlayAuthenticate
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
  def unverified() = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.unverified.render())
  }

  def oAuthDenied(getProviderKey: String) = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.oAuthDenied.render(getProviderKey))
  }

  def exists() = NoCacheAction { implicit request =>
    Ok(views.html.account.signup.exists.render())
  }
}

