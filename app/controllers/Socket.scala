package controllers

import play.api.mvc._
import play.api.Play.current
import play.api.libs.json._


/**
 *
 */
object Socket extends Controller
{
  /**
   *
   */
  def open = WebSocket.acceptWithActor[JsValue, JsValue] { implicit request => out =>
    val user = Application.getActingUser(request).getOrElse(null)
    Actors.SocketActor.props(user, out)
  }
}

