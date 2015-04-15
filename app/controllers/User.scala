package controllers

import play.api.libs.json.Json
import play.api.mvc._


object User extends Controller
{
  /**
   * Look up a user by id.
   */
  def apiGetUser(id: String) = Action { implicit request =>
    models.User.findById(id) map { user =>
      Ok(Json.toJson(user))
    } getOrElse(NotFound)
  }
}
