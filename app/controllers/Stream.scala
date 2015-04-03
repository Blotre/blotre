package controllers

import Actors.{StreamSupervisor}
import org.bson.types.ObjectId
import play.api.mvc._
import play.api.libs.json._
import play.api.Play.current
import scala.collection.immutable._
import helper._
import helper.ImageHelper

/**
 *
 */
object Stream extends Controller
{
  import models.Serializable._
  import ControllerHelper._

  val AcceptsPng = Accepting("image/png")

  def uriMap(uri: String): Map[String, String] = {
    (uri
      .split('/')
      .foldLeft(("", Map[String, String]())) { (p, c) =>
        (p._1 + "/" + c, p._2 + (c -> (p._1 + "/" + c)))
      })._2
  }

  /**
   * Stream root index page.
   *
   * Displays a list of streams for searching.
   */
  def index = Action { implicit request => JavaContext.withContext {
    val query = request.getQueryString("query").getOrElse("")
    val streams = if (query.isEmpty) models.Stream.findByUpdated() else models.Stream.findByQuery(query)
    render {
      case Accepts.Html() =>
        Ok(views.html.stream.index.render())

      case Accepts.Json() =>
        Ok(Json.obj(
          "query" -> query,
          "streams" -> streams
        ))
    }
  }}

  /**
   * Lookup a stream.
   *
   * Supports:
   *     png - Render 1x1 image of the current status.
   *
   *     html - View of the stream.
   *
   *     json: Returns json of the stream.
   */
  def getStream(uri: String) = Action { implicit request => JavaContext.withContext {
    val pathAndExt = uri.split('.')
    val path = pathAndExt(0)
    if (pathAndExt.length == 2 && pathAndExt(1) == "png")
      renderStreamStatusPng(path, request)
    else {
      render {
        case Accepts.Html() =>
          renderStream(path, request)

        case Accepts.Json() =>
          renderStreamJson(path, request)

        case AcceptsPng() =>
          renderStreamStatusPng(path, request)
      }
    }
  }}

  /**
   * Render a stream as html.
   *
   * Displays a try create page if the stream does not exist but the parent does.
   */
  def renderStream(uri: String, request: Request[AnyContent]) =
    models.Stream.findByUri(uri) match {
      case Some(s) =>
        val map = uriMap(s.uri)
        Ok(views.html.stream.stream.render(s, s.getChildren(), uriPath = map))

      case _ =>
        tryCreateDecendant(uri, request)
    }

  /**
   * Render a stream as Json.
   */
  def renderStreamJson(uri: String, request: Request[AnyContent]): Result =
    models.Stream.findByUri(uri)
      .map(s =>
        renderStreamJson(s, request))
      .getOrElse(NotFound)


  def renderStreamJson(stream: models.Stream, request: Request[AnyContent]): Result =
    Ok(Json.toJson(stream).as[JsObject] + ("children", Json.toJson(models.Stream.getChildrenData(stream))))

  /**
   * Render a stream's current status as a 1x1 PNG image.
   */
  def renderStreamStatusPng(uri: String, request: Request[AnyContent]) =
    models.Stream.findByUri(uri)
      .map(s => {
        val img = ImageHelper.createImage(s.status.color)
        noCache(Ok(ImageHelper.toPng(img)))
          .as("image/png")
      })
      .getOrElse(NotFound)

  def setStreamStatus(uri: String) = AuthorizedAction(parse.json) { request => {
    models.Stream.findByUri(uri) map { stream =>
      apiSetStreamStatus(stream, request.user, request)
    } getOrElse(NotFound)
  }}

  /**
   * Checks if child stream can created and displays an create page.
   *
   * A child stream can only be created if its direct parent exists and
   * is owned by the current user.
   */
  def tryCreateDecendant(uri: String, request: Request[AnyContent]) = {
    val user = Application.getLocalUser(request)
    getParentPath(uri) match {
      case Some((parent, child)) =>
        models.Stream.findByUri(parent)
          .flatMap({ stream =>
            models.Stream.asEditable(user, stream)
          })
          .map(stream =>
            Ok(views.html.stream.createChild.render(stream, child)))
          .getOrElse(
            NotFound(views.html.notFound.render("")))

      case _ =>
        NotFound(views.html.notFound.render(""))
    }
  }

  /**
   */
  def createChildStream(uri: String) = AuthenticatedAction { implicit request =>
    val user = Application.getLocalUser(request)
    render {
      case Accepts.Json() =>
        createDescendant(uri, user)
          .map(s =>
            renderStreamJson(s, request))
          .getOrElse(BadRequest)

      case Accepts.Html() =>
        createDescendant(uri, user)
          .map(s =>
            Redirect(routes.Stream.getStream(s.uri)))
          .getOrElse(BadRequest)
    }
  }

  private def createDescendant(uri: String, user: models.User) =
    getParentPath(uri) flatMap { s =>
      models.Stream.createDescendant(s._1, s._2, user)
    }

  private def getParentPath(uri: String) = {
    val index = uri.lastIndexOf('/')
    if (index == -1 || index >= uri.length - 1)
      None
    else
      Some((uri.slice(0, index), uri.slice(index + 1, uri.length)))
  }

  /**
   *
   */
  def apiGetStream(id: String) = Action { implicit request => {
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream))
    } getOrElse {
      NotFound
    }
  }}

  /**
   *
   */
  def apiGetStreamStatus(id: String) = Action { implicit request => {
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream.status))
    } getOrElse {
      NotFound
    }
  }}

  /**
   *
   */
  def apiSetStreamStatus(id: String): Action[JsValue] = AuthorizedAction(parse.json) { request => {
    models.Stream.findById(id) map { stream =>
      apiSetStreamStatus(stream, request.user, request)
    } getOrElse(NotFound)
  }}

  def apiSetStreamStatus(stream: models.Stream, user: models.User, request: Request[JsValue]): Result = {
    models.Stream.asEditable(user, stream) map { stream =>
      ((__ \ "color").read[String]).reads(request.body) map { status =>
        updateStreamStatus(stream, status, user) map { _ =>
          Ok("")
        } getOrElse(BadRequest)
      } recoverTotal {
        e => BadRequest
      }
    } getOrElse(Unauthorized)
  }

  /**
   *
   */
  def apiGetChildren(id: String) = Action { implicit request => {
    models.Stream.findById(id) map { stream =>
      renderStreamJson(stream, request)
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def apiGetChild(id: String, childId: String) = Action { implicit request => {
    models.Stream.findById(id) flatMap { stream =>
      models.Stream.getChildById(stream, new ObjectId(childId))
    } map { childData =>
      Ok(Json.toJson(childData))
    } getOrElse(NotFound)
  }}

  /**
   *
   */
  def apiCreateChild(id: String) = AuthorizedAction(parse.json) { implicit request =>
    val user = Application.getLocalUser(request)
    models.Stream.findById(id) map { parent =>
      ((__ \ "childId").read[ObjectId]).reads(request.body) map { childId =>
        models.Stream.addChild(parent, childId, user) map { childData =>
          Ok(Json.toJson(childData))
        } getOrElse(BadRequest)
      } recoverTotal { _ =>
        BadRequest
      }

    } getOrElse(NotFound)
  }

  /**
   * Can a user edit a given stream?
   */
  def canUpdateStreamStatus(stream: models.Stream, poster: models.User): Option[models.Stream] = {
    if (poster != null && stream != null)
      if (stream.ownerId == poster.id)
        return Some(stream);
    return None;
  }

  def canUpdateStreamStatus(uri: String, poster: models.User): Option[models.Stream] =
    models.Stream.findByUri(uri)
      .flatMap(x => canUpdateStreamStatus(x, poster))

  /**
   *
   */
  private def updateStreamStatus(stream: models.Stream, color: String, poster: models.User) =
    canUpdateStreamStatus(stream, poster) flatMap { _ =>
      models.Stream.updateStreamStatus(stream, color, poster)
    } map { s =>
      StreamSupervisor.updateStatus(stream.uri, s.status)
    }
}

