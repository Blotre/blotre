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
case class ApiSetStatusData(color: String)

object ApiSetStatusData
{
  val colorValidate = Reads.of[String].filter(ValidationError("Color is not valid."))(_.matches(models.Status.colorPattern.toString))

  implicit val apiSetStatusDataReads: Reads[ApiSetStatusData] = (__ \ "color").read (colorValidate).map (ApiSetStatusData.apply _)
}

/**
 *
 */
case class ApiCreateStreamData(name: String, uri: String, status: Option[ApiSetStatusData])

object ApiCreateStreamData
{
  def nameValidate = Reads.StringReads.filter(ValidationError("Name is not valid."))(_.matches(models.Stream.streamNamePattern.toString))

  implicit val apiCreateStreamDataReads: Reads[ApiCreateStreamData] = (
    (JsPath \ "name").read[String](nameValidate) and
      (JsPath \ "uri").read[String] and
      (JsPath \ "status").readNullable[ApiSetStatusData]
    )(ApiCreateStreamData.apply _)
}

/**
 *
 */
object Stream extends Controller {

  import models.Serializable._
  import ControllerHelper._

  val AcceptsPng = Accepting("image/png")

  def uriMap(uri: String): Seq[(String, String)] =
    (uri
      .split('/')
      .foldLeft(("", Seq[(String, String)]())) { (p, c) =>
      (p._1 + "/" + c, p._2 :+(c, (p._1 + "/" + c)))
    })._2

  private def toResponse[T](result: ApiResult[T])(implicit writes: Writes[T]) =
    result match {
      case _: ApiCreated[T] => Created(result.toJson)
      case _: ApiOk[T] => Ok(result.toJson)
      case _: ApiSuccess[T] => Ok(result.toJson)

      case _: ApiUnauthroized => Unauthorized(result.toJson)
      case _: ApiNotFound => NotFound(result.toJson)
      case _: ApiInternalError => InternalServerError(result.toJson)
      case _: ApiCouldNotProccessRequest => UnprocessableEntity(result.toJson)
      case _: ApiFailure[T] => BadRequest(result.toJson)
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
        Ok(Json.toJson(streams))
    }
  }
  }

  /**
   * Lookup a stream.
   *
   * Supports:
   * png - Render 1x1 image of the current status.
   *
   * html - View of the stream.
   *
   * json: Returns json of the stream.
   */
  def getStream(uri: String) = Action { implicit request => JavaContext.withContext {
    val pathAndExt = models.Stream.normalizeUri(uri).split('.')
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
  }
  }

  /**
   * Render a stream as html.
   *
   * Displays a try create page if the stream does not exist but the parent does.
   */
  def renderStream(uri: String, request: Request[AnyContent]) =
    models.Stream.findByUri(uri) match {
      case Some(s) =>
        Ok(views.html.stream.stream.render(s, s.getChildren(), uriPath = uriMap(s.uri)))

      case _ =>
        tryCreateDecendant(uri, Application.getLocalUser(request))
    }

  /**
   * Render a stream as Json.
   */
  def renderStreamJson(uri: String, request: Request[AnyContent]): Result =
    models.Stream.findByUri(uri)
      .map(renderStreamJson)
      .getOrElse(NotFound)


  def renderStreamJson(stream: models.Stream): Result =
    Ok(Json.toJson(stream))

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
    toResponse(apiSetStreamStatus(request.user, uri, request.body))
  }

  /**
   * Checks if child stream can created and displays an create page.
   *
   * A child stream can only be created if its direct parent exists and
   * is owned by the current user.
   */
  def tryCreateDecendant(uri: String, user: models.User) =
    getParentFromPath(uri) map {
      case (parent, child) =>
        models.Stream.asEditable(user, parent) map { stream =>
          Ok(views.html.stream.createChild.render(stream, child))
        } getOrElse (Unauthorized)
    } getOrElse {
      NotFound(views.html.notFound.render(""))
    }

  /**
   *
   */
  def createChildStream(uri: String) = AuthenticatedAction { implicit request =>
    val user = Application.getLocalUser(request)
    render {
      case Accepts.Json() =>
        createDescendant(user, uri)
          .map(renderStreamJson)
          .getOrElse(BadRequest)

      case Accepts.Html() =>
        createDescendant(user, uri)
          .map(s =>
          Redirect(routes.Stream.getStream(s.uri)))
          .getOrElse(BadRequest)
    }
  }

  private def createDescendant(user: models.User, uri: String): Option[models.Stream] =
    getParentFromPath(uri) flatMap { case (parent, child) =>
      createDescendant(user, parent, child)
    }

  private def createDescendant(user: models.User, parent: models.Stream, name: String): Option[models.Stream] =
    models.Stream.createDescendant(parent.uri, name, user) flatMap { newChild =>
      addChild(user, true, parent, newChild)
    }

  private def getParentFromPath(uri: String) =
    getParentPath(uri) flatMap {
      case (parentUri, child) =>
        models.Stream.findByUri(parentUri).map(parent => (parent, child))
    }

  private def getParentPath(inputUri: String) = {
    val uri = models.Stream.normalizeUri(inputUri)
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
  def apiGetStream(id: String) = Action { implicit request =>
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream))
    } getOrElse(NotFound)
  }

  /**
   * Create a new stream.
   *
   * Cannot create root streams.
   */
  def apiCreateStream(): Action[JsValue] = AuthorizedAction(parse.json) { implicit request =>
    (Json.fromJson[ApiCreateStreamData](request.body)).fold(
      valid = value => {
        toResponse(apiCreateStream(request.user, value.name, value.uri, value.status))
      },
      invalid = e =>
        BadRequest(Json.toJson(ApiError("Could not process request", e))))
  }

  def apiCreateStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData]): ApiResult[models.Stream] = {
    if (!name.matches(models.Stream.streamNamePattern.toString))
      return ApiCouldNotProccessRequest(ApiError("Stream name is invalid."))

    models.Stream.findByUri(uri) map { existing =>
      ApiCouldNotProccessRequest(ApiError("Stream already exists."))
    } getOrElse {
      getParentFromPath(uri) map { case (parent, childName) =>
        if (!childName.equalsIgnoreCase(name)) {
          ApiCouldNotProccessRequest(ApiError("Stream name and uri do not match."))
        } else {
          models.Stream.asEditable(user, parent) map { parent =>
            if (parent.childCount() >= models.Stream.maxChildren)
              ApiCouldNotProccessRequest(ApiError("Too many children."))
            else
              createDescendant(user, parent, name) map { newStream =>
                status.map(s => updateStreamStatus(newStream, s.color, user))
                ApiCreated(newStream)
              } getOrElse (ApiInternalError())
          } getOrElse (ApiUnauthroized(ApiError("User does not have permission to add child.")))
        }
      } getOrElse (ApiNotFound(ApiError("Parent stream does not exist.")))
    }
  }

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(id: String): Action[Unit] = AuthorizedAction(parse.empty) { implicit request =>
    toResponse(apiDeleteStream(request.user, id))
  }

  def apiDeleteStream(user: models.User, id: String): ApiResult[models.Stream] =
    models.Stream.findById(id) map { stream =>
      apiDeleteStream(user, stream)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  def apiDeleteStream(user: models.User, stream: models.Stream): ApiResult[models.Stream] =
    models.Stream.asEditable(user, stream) map { ownedStream =>
      if (ownedStream.name == ownedStream.uri) {
        ApiCouldNotProccessRequest(ApiError("Cannot delete root streams."))
      } else {
        deleteStream(stream)
        ApiOk(stream)
      }
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to delete stream."))
    }

  /**
   * Lookup that status of a stream.
   */
  def apiGetStreamStatus(id: String) = Action { implicit request =>
    models.Stream.findById(id) map { stream =>
      Ok(Json.toJson(stream.status))
    } getOrElse (NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }

  /**
   * Set the status of a stream.
   */
  def apiSetStreamStatus(id: String): Action[JsValue] = AuthorizedAction(parse.json) { implicit request =>
    toResponse(apiSetStreamStatus(request.user, id, request.body))
  }

  def apiSetStreamStatus(user: models.User, id: String, body: JsValue): ApiResult[models.Status] =
    Json.fromJson[ApiSetStatusData](body) map { status =>
      apiSetStreamStatus(user, id, status)
    } recoverTotal { e =>
      ApiCouldNotProccessRequest(ApiError("Could not process request.", e))
    }

  def apiSetStreamStatus(user: models.User, streamId: String, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.findById(streamId) map { stream =>
      apiSetStreamStatus(user, stream, status)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  def apiSetStreamStatus(user: models.User, stream: models.Stream, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.asEditable(user, stream) map { stream =>
      updateStreamStatus(stream, status.color, user) map { status =>
        ApiOk(status)
      } getOrElse (ApiInternalError())
    } getOrElse (ApiUnauthroized(ApiError("User does not have permission to edit stream.")))

  /**
   * Get children of a stream.
   *
   * Returns either the most recent children or
   *
   * TODO: normally should return list of ids which query params can expand to stream.
   */
  def apiGetChildren(id: String) = Action.async { implicit request =>
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
      } getOrElse (Future.successful(NotFound(Json.toJson(ApiError("Stream does not exist.")))))
    }

  def apiGetChildren(id: String, query: String): Future[ApiResult[List[models.Stream]]] =
    models.Stream.findById(id) map { stream =>
     apiGetChildren(stream, query)
    } getOrElse (Future.successful(ApiNotFound(ApiError("Stream does not exist."))))

  def apiGetChildren(stream: models.Stream, query: String): Future[ApiResult[List[models.Stream]]] =
    if (query.isEmpty) {
      // Get most recently updated children
      CollectionSupervisor.getCollectionState(stream.uri, 20, 0) map { children =>
        ApiOk(children.map(models.Stream.findByUri(_)).flatten[models.Stream])
      }
    } else {
      // Lookup children using query
      Future.successful(ApiOk(models.Stream.getChildrenByQuery(stream, query, 20)))
    }

  /**
   * Get a child of this stream.
   */
  def apiGetChild(parentId: String, childId: String) = Action { implicit request =>
    (for {
      parent <- stringToObjectId(parentId);
      child <- stringToObjectId(childId);
      childData <- models.Stream.getChildById(parent, child);
      child <- models.Stream.findById(childData.childId)
    } yield Ok(Json.toJson(child))) getOrElse NotFound(Json.toJson(ApiError("Stream does not exist.")))
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
      child <- models.Stream.findById(childId)
    } yield (
        if (canUpdateStreamStatus(parent, user).isDefined) {
          if (childData.hierarchical)
            UnprocessableEntity(Json.toJson(ApiError("Cannot remove hierarchical child.")))
          else {
            removeChild(parent, child)
            Ok("")
          }
        } else Unauthorized(Json.toJson(ApiError("User does not have permission to edit stream."))))
      ) getOrElse (NotFound(Json.toJson(ApiError("Stream does not exist."))))
  }


  /**
   * Link an existing stream as a child of a stream.
   *
   * Noop if the child already exists.
   */
  def apiCreateChild(parentId: String, childId: String) = AuthorizedAction { implicit request => {
    models.Stream.findById(parentId) map { parent =>
      if (parent.childCount <= models.Stream.maxChildren)
        apiCreateChildInternal(request.user, parent, childId)
      else
        UnprocessableEntity(Json.toJson(ApiError("Too many children.")))
    } getOrElse (NotFound(Json.toJson(ApiError("Parent stream does not exist."))))
  }}

  def apiCreateChildInternal(user: models.User, parent: models.Stream, childId: String): Result =
    models.Stream.asEditable(user, parent) map { parent =>
      models.Stream.findById(childId) map { child =>
        apiCreateChildInternal(user, parent, child)
      } getOrElse (NotFound(Json.toJson(ApiError("Child stream does not exist."))))
    } getOrElse (Unauthorized(Json.toJson(ApiError("User does not have permission to add child."))))

  def apiCreateChildInternal(user: models.User, parent: models.Stream, child: models.Stream): Result =
    if (parent.id == child.id)
      UnprocessableEntity(Json.toJson(ApiError("I'm my own grandpa.")))
    else
      models.Stream.getChildById(parent.id, child.id) map { _ =>
        Ok(Json.toJson(child))
      } orElse {
        addChild(user, false, parent, child) map { _ =>
          Created(Json.toJson(child))
        }
      } getOrElse (InternalServerError)

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

  private def addChild(user: models.User, heirarchical: Boolean, parent: models.Stream, child: models.Stream): Option[models.Stream] =
    if (parent.childCount < models.Stream.maxChildren)
      models.Stream.addChild(heirarchical, parent, child.id, user) map { newChildData =>
        StreamSupervisor.addChild(parent, child)
        child
      }
    else
      None

  private def removeChild(parent: models.Stream, child: models.Stream): Option[models.Stream] = {
    models.Stream.removeChild(parent, child.id)
    StreamSupervisor.removeChild(parent.uri, child.uri)
    Some(child)
  }

  private def removeChild(childData: models.ChildStream): Unit = {
    models.Stream.removeChild(childData)
    StreamSupervisor.removeChild(childData.parentUri, childData.childUri)
  }

  private def deleteStream(stream: models.Stream): Unit = {
    models.Stream.getChildrenData(stream) foreach { childData =>
      removeChild(childData)
      if (childData.hierarchical) {
        models.Stream.findById(childData.childId).map(deleteStream)
      }
    }
    models.Stream.getRelations(stream).foreach(removeChild)
    models.Stream.deleteStream(stream)
    StreamSupervisor.deleteStream(stream.uri)
  }
}

