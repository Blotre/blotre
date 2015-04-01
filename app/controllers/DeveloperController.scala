package controllers

import play.api.mvc._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.Security.Authenticated

case class CreateClientForm(name: String, uri: String, blurb: String)

object DeveloperController extends Controller
{
  val createClientForm = Form(mapping(
    "name" -> nonEmptyText(3, 255),
    "uri" ->  nonEmptyText(3, 255),
    "blurb" ->  nonEmptyText(3, 255))(CreateClientForm.apply)(CreateClientForm.unapply)
  )

  def index() = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    val clients = models.Client.findForUser(user)
    Ok(views.html.developer.index.render(clients))
  }}

  def createClient() = AuthenticatedAction { implicit request => JavaContext.withContext {
    Ok(views.html.developer.createClient.render(createClientForm))
  }}

  def createClientSubmit() = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    createClientForm.bindFromRequest.fold(
      formWithErrors =>
        Ok(views.html.developer.createClient.render(formWithErrors)),

      value =>
        Ok("")
    )
  }}
}
