package controllers

import play.api.mvc._
import scalaoauth2.provider._
import oauth.MyDataHandler
import scala.concurrent.ExecutionContext.Implicits.global

object OAuth2Controller extends Controller with OAuth2Provider
{
  def authorize = Action { implicit request =>
    val client_id = request.getQueryString("client_id").getOrElse("")
    val redirect_uri = request.getQueryString("redirect_uri").getOrElse("")
    models.Client.findById(client_id) flatMap { client =>
      models.Client.validateRedirect(client, redirect_uri)
    } map { client =>
      Ok(views.html.oauth.authorize.render(client))
    } getOrElse(BadRequest)
  }

  def accessToken = Action.async { implicit request =>
    issueAccessToken(new MyDataHandler())
  }
}