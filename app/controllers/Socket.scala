package controllers

import api.socket.SocketActor
import play.api.mvc._
import play.api.Play.current
import play.api.libs.json._

/**
 * Web socket Api
 */
object Socket extends Controller
{
  /**
   * Open a new websocket connection.
   */
  def open = WebSocket.acceptWithActor[JsValue, JsValue] { implicit request => out =>
    val user = Application.getActingUser(request).getOrElse(null)
    SocketActor.props(user, out)
  }
}

