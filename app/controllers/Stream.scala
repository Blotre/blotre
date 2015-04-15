package controllers

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.api.data.validation._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.Play.current
import scala.collection.immutable._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import helper.ImageHelper

/**
 *
 */
object Stream extends Controller
{
  import models.Serializable._
  import ControllerHelper._

  val AcceptsPng = Accepting("image/png")

  def uriMap(uri: String): Seq[(String, String)] =
    (uri
      .split('/')
      .foldLeft(("", Seq[(String, String)]())) { (p, c) =>
        (p._1 + "/" + c, p._2 :+ (c, (p._1 + "/" + c)))
      })._2

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
        Ok(Json.toJson(streams))
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
    Ok(Json.toJson(stream).as[JsObject])

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

  def setStreamStatus(uri: String) = AuthorizedAction(parse.json) { request =>
    models.Stream.findByUri(uri) map { stream =>
      apiSetStreamStatus(stream, request.user, request)
    } getOrElse(NotFound)
  }

  /**
   * Checks if child stream can created and displays an create page.
   *
   * A child stream can only be created if its direct parent exists and
   * is owned by the current user.
   */
  def tryCreateDecendant(uri: String, request: Request[AnyContent]) = {
    getParentFromPath(uri) map {
      case (parent, child) =>
        val user = Application.getLocalUser(request)
        models.Stream.asEditable(user, parent) map { stream =>
          Ok(views.html.stream.createChild.render(stream, child))
        } getOrElse(Unauthorized)
    } getOrElse {
        NotFound(views.html.notFound.render(""))
    }
  }

  /**
   *
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

  private def createDescendant(uri: String, user: models.User): Option[models.Stream] =
    getParentFromPath(uri) flatMap { case (parent, child) =>
      createDescendant(parent, child, user)
    }

  private def createDescendant(parent: models.Stream, name: String, user: models.User): Option[models.Stream] = {
    models.Stream.createDescendant(parent.uri, name, user) map { newChild =>
      addChild(parent, newChild, user)
      newChild
    }
  }

  private def getParentFromPath(uri: String) =
    getParentPath(uri) flatMap {
      case (parentUri, child) =>
        models.Stream.findByUri(parentUri).map(parent => (parent, child))
    }

  private def getParentPath(uri: String) = {
    val index = uri.lastIndexOf('/')
    if (index == -1 || index >= uri.length - 1)
      None
    else {
      val parent = uri.slice(0, index)
      val child = uri.slice(index + 1, uri.length)
      if (models.Stream.isValidStreamName(child))
        Some((parent, child))
      else
        None
    }
  }

  /**
   * Lookup a stream by id.
   */
  def apiGetStream(id: String) = Action { implicit request => {
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream))
    } getOrElse {
      NotFound
    }
  }}

  val colorValidate = Reads.of[String].filter(ValidationError("Color is not valid."))(_.matches(models.Status.colorPattern.toString))

  case class ApiSetStatusData(color: String)

  implicit val apiSetStatusDataReads: Reads[ApiSetStatusData] = (__ \ "color").read(colorValidate).map(ApiSetStatusData.apply _)

  case class ApiCreateStreamData(name: String, uri: String, status: Option[ApiSetStatusData])

  def nameValidate = Reads.StringReads.filter(ValidationError("Name is not valid."))(_.matches(models.Stream.streamNamePattern.toString))

  implicit val apiCreateStreamDataReads: Reads[ApiCreateStreamData] = (
      (JsPath \ "name").read[String](nameValidate) and
      (JsPath \ "uri").read[String] and
        (JsPath \ "status").readNullable[ApiSetStatusData]
    )(ApiCreateStreamData.apply _)

  /**
   * Create a new stream.
   *
   * Api cannot create root streams.
   */
  def apiCreateStream(): Action[JsValue] = AuthorizedAction(parse.json) { implicit request =>
    (Json.fromJson[ApiCreateStreamData](request.body)).fold(
      valid = value => {
        apiCreateStream(request, value.name, value.uri, value.status, request.user)
      },
      invalid = e =>
        BadRequest(Json.toJson(ApiError("Could not process request", e))))
  }

  def apiCreateStream(request: Request[JsValue], name: String, uri: String, status: Option[ApiSetStatusData], user: models.User): Result =
    models.Stream.findByUri(uri) map {
      existing =>
        UnprocessableEntity(Json.toJson(ApiError("Stream already exists")))
    } getOrElse {
      getParentFromPath(uri) map { case (parent, childName) =>
        if (childName != name) {
          UnprocessableEntity(Json.toJson(ApiError("Stream name and uri do not match")))
        } else {
          models.Stream.asEditable(user, parent) map { parent =>
            createDescendant(parent, name, user) map { newStream =>
              status.map(s => updateStreamStatus(newStream, s.color, user))
              Ok(Json.toJson(newStream))
            } getOrElse(InternalServerError)
          } getOrElse(Unauthorized(Json.toJson(ApiError("User does not have permission to add child."))))
        }
      } getOrElse(NotFound(Json.toJson(ApiError("Parent stream does not exist."))))
    }

  /**
   * Lookup that status of a stream.
   */
  def apiGetStreamStatus(id: String) = Action { implicit request =>
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream.status))
    } getOrElse(NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }

  /**
   * Set the status of a stream.
   */
  def apiSetStreamStatus(id: String): Action[JsValue] = AuthorizedAction(parse.json) { implicit request =>
    models.Stream.findById(id) map { stream =>
      apiSetStreamStatus(stream, request.user, request)
    } getOrElse(NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }

  def apiSetStreamStatus(stream: models.Stream, user: models.User, request: Request[JsValue]): Result =
    Json.fromJson[ApiSetStatusData](request.body) map { status =>
      models.Stream.asEditable(user, stream) map { stream =>
        updateStreamStatus(stream, status.color, user) map { status =>
          Ok(Json.toJson(status))
        } getOrElse(InternalServerError)
      } getOrElse(Unauthorized(Json.toJson(ApiError("User does not have permission to edit stream."))))
    } recoverTotal { e =>
      BadRequest(Json.toJson(ApiError("Could not process request", e)))
    }

  /**
   * Get children of a stream.
   *
   * Returns either the most recent children or
   *
   * TODO: normally should return list of ids which query params can expand to stream.
   */
  def apiGetChildren(id: String) = Action.async { implicit request => {
    val query = request.getQueryString("query").getOrElse("")
    models.Stream.findById(id) map { stream =>
      if (query.isEmpty) {
        // Get most recently updated children
        CollectionSupervisor.getCollectionState(stream.uri, 20, 0) map { children =>
          Ok(Json.toJson(children.map(models.Stream.findByUri(_))))
        }
      } else {
        // Lookup children using query
        Future.successful(Ok(Json.toJson(models.Stream.getChildrenByQuery(stream, query, 20))))
      }
    } getOrElse(Future.successful(NotFound(Json.toJson(ApiError("Stream does not exist.")))))
  }}

  /**
   * Get a child of this stream.
   */
  def apiGetChild(parentId: String, childId: String) = Action { implicit request =>
    (for {
      parent <- stringToObjectId(parentId);
      child <- stringToObjectId(childId);
      childData <- models.Stream.getChildById(parent, child);
      child <- models.Stream.findById(childData.childId)
    } yield Ok(Json.toJson(child))) getOrElse(NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }


  /**
   * Remove a linked child stream.
   *
   * Does not delete the target stream and cannot be used to delete hierarchical children.
   */
  def apiDeleteChild(parentId: String, childId: String) = AuthorizedAction { implicit request =>
    val user = request.user
    (for {
      parentId <- stringToObjectId(parentId);
      childId <- stringToObjectId(childId);
      parent <- models.Stream.findById(parentId);
      childData <- models.Stream.getChildById(parentId, childId)
    } yield (
        if (canUpdateStreamStatus(parent, user).isDefined) {
          if (childData.hierarchical)
            UnprocessableEntity(Json.toJson(ApiError("Cannot remove hierarchical child.")))
          else {
            models.Stream.removeChild(parent, childData.childId)
            Ok("")
          }
        } else Unauthorized(Json.toJson(ApiError("User does not have permission to edit stream."))))
      ) getOrElse(NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }


  /**
   * Link an existing stream as a child of a stream.
   *
   * Noop if the child already exists
   */
  def apiCreateChild(parentId: String, childId: String) = AuthorizedAction{ implicit request =>
    val user = Application.getLocalUser(request)
    models.Stream.findById(parentId) map { parent =>
      models.Stream.asEditable(user, parent) map { parent =>
        models.Stream.findById(childId) map { child =>
          addChild(parent, child, user) map { childData =>
            Ok("")
          } getOrElse(InternalServerError)
        } getOrElse(NotFound(Json.toJson(ApiError("Child stream does not exist."))))
      } getOrElse(Unauthorized(Json.toJson(ApiError("User does not have permission to add child."))))
    } getOrElse(NotFound(Json.toJson(ApiError("Parent stream does not exist."))))
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
  private def updateStreamStatus(stream: models.Stream, color: String, poster: models.User): Option[models.Status] =
    canUpdateStreamStatus(stream, poster) flatMap { _ =>
      models.Stream.updateStreamStatus(stream, color, poster)
    } map { s =>
      StreamSupervisor.updateStatus(stream.uri, s.status)
      s.status
    }

  private def addChild(parent: models.Stream, child: models.Stream, user: models.User): Option[models.ChildStream] =
    models.Stream.addChild(parent, child.id, user) map { newChildData =>
      StreamSupervisor.addChild(parent.uri, child)
      newChildData
    }
}

