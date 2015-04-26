package controllers

import play.api.libs.json.Json
import play.api.mvc._
import play.api.data._
import play.api.data.Forms._
import play.i18n.Messages


case class CreateClientForm(name: String, uri: String, blurb: String)

case class CreateRedirectForm(uri: String)


object DeveloperController extends Controller
{
  val createClientForm = Form(mapping(
    "name" -> nonEmptyText(3, 255),
    "uri" ->  nonEmptyText(3, 255).verifying("Http(s) url", uri => uri.startsWith("http://") || uri.startsWith("https://")),
    "blurb" ->  nonEmptyText(3, 255)
  )(CreateClientForm.apply)(CreateClientForm.unapply))

  def index() = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    val clients = models.Client.findForUser(user)
    Ok(views.html.developer.index.render(clients))
  }}

  def createClient() = AuthenticatedAction { implicit request => JavaContext.withContext {
    Ok(views.html.developer.createClient.render(createClientForm))
  }}

  /**
   * Create a new client for the current user from a form submission.
   */
  def createClientSubmit() = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    createClientForm.bindFromRequest.fold(
      formWithErrors =>
        Ok(views.html.developer.createClient.render(formWithErrors)),

      value =>
        if (models.Client.findForUser(user).length >= models.Client.maxClientCount)
          Ok(views.html.developer.createClient.render(createClientForm.fillAndValidate(value)))
            .flashing("error" -> Messages.get("blotre.developer.client.error.tooManyClients"))
        else
          models.Client.createClient(value.name, value.uri, value.blurb, user) map { _ =>
            Redirect(routes.DeveloperController.index)
          } getOrElse(InternalServerError))
  }}

  /**
   * Render client information page.
   */
  def getClient(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    val user = Application.getLocalUser(request)
    models.Client.findByIdForUser(id, user) map { client =>
      Ok(views.html.developer.client.render(client))
    } getOrElse(NotFound)
  }}

  /**
   * Delete an existing client.
   */
  def deleteClient(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    models.Client.findByIdForUser(id, request.user) map { client =>
      models.Client.deleteClient(client)
      Redirect(routes.DeveloperController.index)
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def regenerateSecret(id: String) = AuthenticatedAction { implicit request => JavaContext.withContext {
    models.Client.findByIdForUser(id, request.user) map { client =>
      models.Client.regenerateSecret(client) map { client =>
        Redirect(routes.DeveloperController.getClient(client.id.toString))
      } getOrElse(InternalServerError)
    } getOrElse(NotFound)
  }}

  /**
   * Update the redirects of a given client
   */
  def setRedirects(clientId: String) = AuthenticatedAction(parse.json) { implicit request => JavaContext.withContext {
    models.Client.findByIdForUser(clientId, request.user) map { client =>
      Json.fromJson[Array[String]](request.body) map { redirects =>
        validateRedirects(redirects) map { validatedredirects =>
          models.Client.setRedirects(client, validatedredirects )
          Ok("")
        } getOrElse(UnprocessableEntity)
      } recoverTotal { e =>
        UnprocessableEntity
      }
    } getOrElse(NotFound)
  }}

  private def validateRedirects(redirects: Array[String]) =
    if (redirects.length <= models.Client.maxRedirects
      && redirects.forall(redirect => redirect.matches("(http://|https://)[" + models.Client.validUrlCharacters + "]{3,1000}")))
      Some(redirects)
    else
      None
}
