package controllers

import play.api.mvc._


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

