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
    "uri" ->  nonEmptyText(3, 255).verifying("Https url", uri => uri.startsWith("https://")),
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
        models.Client.createClient(value.name, value.uri, value.blurb, user) map { _ =>
          Redirect(routes.DeveloperController.index)
        } getOrElse(InternalServerError))
  }}

  def getClient(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      Ok(views.html.developer.client.render(client))
    } getOrElse(NotFound)
  }}

  def regenerateSecret(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      models.Client.regenerateSecret(client) map { client =>
        Redirect(routes.DeveloperController.getClient(client.id.toString))
      } getOrElse(InternalServerError)
    } getOrElse(NotFound)
  }}

}
