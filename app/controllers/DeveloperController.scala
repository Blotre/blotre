package controllers

import play.api.mvc._
import play.api.data._
import play.api.data.Forms._

case class CreateClientForm(name: String, uri: String, blurb: String)

case class CreateRedirectForm(uri: String)


object DeveloperController extends Controller
{
  val createClientForm = Form(mapping(
    "name" -> nonEmptyText(3, 255),
    "uri" ->  nonEmptyText(3, 255).verifying("Http(s) url", uri => uri.startsWith("http://") || uri.startsWith("https://")),
    "blurb" ->  nonEmptyText(3, 255)
  )(CreateClientForm.apply)(CreateClientForm.unapply))

  val createRedirectForm = Form(mapping(
    "uri" ->  nonEmptyText(3, 255).verifying("Http(s) url", uri => uri.startsWith("http://") || uri.startsWith("https://"))
  )(CreateRedirectForm.apply)(CreateRedirectForm.unapply))

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

  /**
   *
   */
  def getClient(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      Ok(views.html.developer.client.render(client, models.Client.findRedirectsForClient(client)))
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def regenerateSecret(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      models.Client.regenerateSecret(client) map { client =>
        Redirect(routes.DeveloperController.getClient(client.id.toString))
      } getOrElse(InternalServerError)
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def addRedirect(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      Ok(views.html.developer.addRedirect.render(client, createRedirectForm))
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def addRedirectSubmit(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      createRedirectForm.bindFromRequest.fold(
        formWithErrors =>
          Ok(views.html.developer.addRedirect.render(client, formWithErrors)),

        value =>
          models.Client.addRedirectUri(client, value.uri, user) map { _ =>
            Redirect(routes.DeveloperController.getClient(client.id.toString))
          } getOrElse(InternalServerError))

    } getOrElse(NotFound)
  }}
}
