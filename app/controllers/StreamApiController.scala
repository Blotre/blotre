package controllers

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.api.data.validation._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.Play.current
import play.utils.UriEncoding
import scala.collection.immutable._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

/**
 *
 */
case class ApiSetStatusData(color: models.Color)

object ApiSetStatusData
{
  implicit val apiSetStatusDataReads: Reads[ApiSetStatusData] =
    (__ \ "color")
      .read(models.Color.readColor)
      .map(color => ApiSetStatusData.apply(models.Color(color)))
}

/**
 *
 */
case class ApiSetTagsData(tags: Seq[models.StreamTag])

object ApiSetTagsData
{
  implicit val streamTagReads: Reads[models.StreamTag] =
    Reads.StringReads
      .map(models.StreamTag.fromString)
      .filter(ValidationError("Tag is not valid."))(_.isDefined)
      .map(_.get)

  implicit val apiSetStatusDataReads: Reads[ApiSetTagsData] =
    Reads.list[models.StreamTag]
      .filter(ValidationError("Too many tags."))(tags => tags.size > models.Stream.maxTags)
      .filter(ValidationError("Duplicate tags not allowed."))(tags => tags.distinct.size != tags.size)
      .map(ApiSetTagsData(_))
}

/**
 *
 */
case class ApiCreateStreamData(name: String, uri: String, status: Option[ApiSetStatusData])

object ApiCreateStreamData
{
  def nameValidate = Reads.StringReads.filter(ValidationError("Name is not valid."))(_.matches(models.StreamName.pattern.toString))

  implicit val apiCreateStreamDataReads: Reads[ApiCreateStreamData] = (
    (JsPath \ "name").read[String](nameValidate) and
      (JsPath \ "uri").read[String] and
      (JsPath \ "status").readNullable[ApiSetStatusData]
    )(ApiCreateStreamData.apply _)
}

object StreamHelper
{
  def getParentFromPath(uri: String) =
    getParentPath(uri) flatMap {
      case (parentUri, childUri) =>
        models.Stream.findByUri(parentUri).map(parent => (parent, childUri))
    }

  def getRawParentPath(uri: String) = {
    val decodedUri = UriEncoding.decodePath(uri, "UTF-8")
    val index = decodedUri.lastIndexOf('/')
    if (index == -1 || index >= decodedUri.length - 1)
      None
    else {
      val parent = decodedUri.slice(0, index)
      val child = decodedUri.slice(index + 1, decodedUri.length)
      Some((parent, child))
    }
  }

  def getParentPath(uri: String) =
    getRawParentPath(models.Stream.normalizeUri(uri).value) map { paths =>
      (paths._1, models.Stream.normalizeUri(paths._2))
    }
}

/**
 * Stream REST api controller.
 */
object StreamApiController extends Controller {

  import models.Serializable._

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

  private def createDescendant(user: models.User, uri: String): Option[models.Stream] =
    StreamHelper.getParentFromPath(uri) flatMap { case (parent, childUri) =>
      models.StreamName.fromString(childUri) flatMap { childName =>
        createDescendant(user, parent, childName)
      }
    }

  private def createDescendant(user: models.User, parent: models.Stream, name: models.StreamName): Option[models.Stream] =
    models.Stream.createDescendant(parent.uri, name, user) flatMap { newChild =>
      addChild(user, true, parent, newChild)
    }

  /**
   * Lookup all streams using an optional query.
   */
  def apiGetStreams(): Action[AnyContent] = Action { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    toResponse(apiGetStreams(query))
  }

  def apiGetStreams(query: String): ApiResult[JsValue] = {
    val queryValue = query.trim()
    ApiOk(Json.toJson(
      if (queryValue.isEmpty)
        models.Stream.findByUpdated()
      else if (queryValue.startsWith("#"))
        models.Stream.findByStatusQuery(query)
      else
        models.Stream.findByQuery(queryValue)))
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

  def apiCreateStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
    models.StreamName.fromString(name) map { validatedName =>
      StreamHelper.getParentFromPath(uri) map { case (parent, childUri) =>
        if (!(models.Stream.normalizeUri(validatedName).value.equalsIgnoreCase(childUri.value)))
          ApiCouldNotProccessRequest(ApiError("Stream name and uri do not match."))
        else
          apiCreateStream(user, parent, uri, validatedName, status)
      } getOrElse (ApiNotFound(ApiError("Parent stream does not exist.")))
    } getOrElse {
      ApiCouldNotProccessRequest(ApiError("Stream name is invalid."))
    }

  private def apiCreateStream(user: models.User, parent: models.Stream, uri: String, validatedName: models.StreamName, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
    models.Stream.asEditable(user, parent) map { parent =>
      models.Stream.findByUri(uri) map { existing =>
        status.map(s => updateStreamStatus(existing, s.color, user))
        ApiOk(existing)
      } getOrElse {
        if (parent.childCount >= models.Stream.maxChildren)
          ApiCouldNotProccessRequest(ApiError("Too many children."))
        else if (user.streamCount >= models.User.streamLimit)
          ApiCouldNotProccessRequest(ApiError("Too many streams for user."))
        else
          createDescendant(user, parent, validatedName) map { newStream =>
            status.map(s => updateStreamStatus(newStream, s.color, user))
            ApiCreated(newStream)
          } getOrElse (ApiInternalError())
      }
    } getOrElse (ApiUnauthroized(ApiError("User does not have permission to add child.")))

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(id: String): Action[Unit] = AuthorizedAction(parse.empty) { implicit request =>
    toResponse(models.Stream.findById(id) map { stream =>
      apiDeleteStream(request.user, stream)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist."))))
  }

  def apiDeleteStream(user: models.User, uri: String): ApiResult[models.Stream] =
    models.Stream.findByUri(uri) map { stream =>
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

  def apiSetStreamStatusForUri(user: models.User, streamUri: String, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.findByUri(streamUri) map { stream =>
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
   * Returns either the most recent children or children from the query
   *
   * TODO: normally should return list of ids which query params can expand to stream?
   */
  def apiGetChildren(id: String): Action[AnyContent] = Action.async { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    models.Stream.findById(id) map { stream =>
      apiGetChildren(stream, query, 20, 0).map(toResponse(_))
    } getOrElse (Future.successful(NotFound(Json.toJson(ApiError("Stream does not exist.")))))
  }

  def apiGetChildren(uri: String, query: String, limit: Int, offset: Int): Future[ApiResult[List[models.Stream]]] =
    models.Stream.findByUri(uri) map { stream =>
      apiGetChildren(stream, query, limit, offset)
    } getOrElse (Future.successful(ApiNotFound(ApiError("Stream does not exist."))))

  def apiGetChildren(stream: models.Stream, query: String, limit: Int, offset: Int): Future[ApiResult[List[models.Stream]]] =
    if (query.isEmpty) {
      // Get most recently updated children
      CollectionSupervisor.getCollectionState(stream.uri, limit, offset) map { children =>
        ApiOk(children.map(models.Stream.findByUri(_)).flatten[models.Stream])
      }
    } else {
      // Lookup children using query
      Future.successful(ApiOk(models.Stream.getChildrenByQuery(stream, query, limit)))
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
      if (parent.childCount >= models.Stream.maxChildren)
        UnprocessableEntity(Json.toJson(ApiError("Too many children.")))
      else
        apiCreateChildInternal(request.user, parent, childId)
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
   * Get all tags associated with a given stream.
   */
  def getTags(streamId: String) = Action { implicit request =>
    (for {
      id <- stringToObjectId(streamId);
      stream <- models.Stream.findById(id)
    } yield
      Ok(Json.toJson(stream.getTags))) getOrElse NotFound(Json.toJson(ApiError("Stream does not exist.")))
  }

  /**
   * Update the tags associated with a given stream.
   */
  def setTags(streamId: String) = AuthorizedAction(parse.json) { implicit request =>
    (for {
      id <- stringToObjectId(streamId);
      stream <- models.Stream.findById(id)
    } yield {
      toResponse(setTagsInternal(request.user, stream, request.body))
    }) getOrElse {
      NotFound(Json.toJson(ApiError("Stream does not exist.")))
    }
  }

  private def setTagsInternal(user: models.User, stream: models.Stream, body: JsValue): ApiResult[models.Stream] =
    Json.fromJson[ApiSetTagsData](body) map { tags =>
      setTagsInternal(user, stream, tags)
    } recoverTotal { e =>
      ApiCouldNotProccessRequest(ApiError("Could not process request.", e))
    }

  private def setTagsInternal(user: models.User, stream: models.Stream, data: ApiSetTagsData) : ApiResult[models.Stream] =
    models.Stream.asEditable(user, stream) map { parent =>
      doSetTags(stream, data.tags)
      ApiOk(stream)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add tags."))
    }

  /**
   * Lookup a tag on a given stream.
   */
  def getTag(streamId: String, tag: String) = Action { implicit request =>
    (for {
      id <- stringToObjectId(streamId);
      stream <- models.Stream.findById(id)
    } yield {
        toResponse(getTagInternal(stream, tag))
      }) getOrElse {
      NotFound(Json.toJson(ApiError("Stream does not exist.")))
    }
  }

  private def getTagInternal(stream: models.Stream, tag: String): ApiResult[String] =
    stream.getTags()
      .filter(streamTag => streamTag.value == tag)
      .headOption
      .map(tag => ApiOk(tag.value))
      .getOrElse(ApiNotFound(ApiError("Stream does not exist.")))

  /**
   * Set a tag on a given stream.
   */
  def setTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    (for {
      id <- stringToObjectId(streamId);
      stream <- models.Stream.findById(id)
    } yield {
        canUpdateStreamStatus(stream, request.user) map { ownedStream =>
          toResponse(setTagInternal(request.user, ownedStream, tag))
        } getOrElse {
          NotFound(Json.toJson(ApiError("User does not have permission to edit stream.")))
        }
      }) getOrElse {
      NotFound(Json.toJson(ApiError("Stream does not exist.")))
    }
  }

  private def setTagInternal(user: models.User, stream: models.Stream, tag: String): ApiResult[String] =
    models.StreamTag.fromString(tag) map {
      setTagInternal(user, stream, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  private def setTagInternal(user: models.User, stream: models.Stream, tag: models.StreamTag): ApiResult[String] =
    if (stream.hasTag(tag))
      ApiOk(tag.value)
    else {
      models.Stream.setTags(stream, stream.getTags() :+ tag)
      ApiCreated(tag.value)
    }

  /**
   * Remove a tag on a given stream.
   */
  def removeTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    (for {
      id <- stringToObjectId(streamId);
      stream <- models.Stream.findById(id)
    } yield {
        canUpdateStreamStatus(stream, request.user) map { ownedStream =>
          toResponse(removeTagInternal(request.user, ownedStream, tag))
        } getOrElse {
          NotFound(Json.toJson(ApiError("User does not have permission to edit stream.")))
        }
      }) getOrElse {
      NotFound(Json.toJson(ApiError("Stream does not exist.")))
    }
  }

  private def removeTagInternal(user: models.User, stream: models.Stream, tag: String): ApiResult[String] =
    models.StreamTag.fromString(tag) map {
      removeTagInternal(user, stream, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  private def removeTagInternal(user: models.User, stream: models.Stream, tag: models.StreamTag): ApiResult[String] =
    if (stream.hasTag(tag)) {
      models.Stream.setTags(stream, stream.getTags() diff List(tag))
      ApiOk(tag.value)
    } else {
      ApiNotFound(ApiError("No such tag."))
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
  private def updateStreamStatus(stream: models.Stream, color: models.Color, poster: models.User): Option[models.Status] =
    canUpdateStreamStatus(stream, poster) flatMap { _ =>
      models.Stream.updateStreamStatus(stream, color, poster)
    } map { s =>
      StreamSupervisor.updateStatus(stream, s.status)
      s.status
    }

  def addChild(user: models.User, heirarchical: Boolean, parent: models.Stream, child: models.Stream): Option[models.Stream] =
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

  /**
   *
   */
  private def doSetTags(stream: models.Stream, tags: Seq[models.StreamTag]): Option[models.Stream] = {
    StreamSupervisor.updateTags(stream, tags)
    Some(stream)
   // models.Stream.setTags(stream, tags)
  }
}

