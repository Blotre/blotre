package controllers

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.api.data.validation._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import scala.collection.immutable._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

/**
 *
 */
case class ApiCreateStreamData(name: String, uri: String, status: Option[ApiSetStatusData])

object ApiCreateStreamData {
  def nameValidate = Reads.StringReads.filter(ValidationError("Name is not valid."))(_.matches(models.StreamName.pattern.toString))

  implicit val apiCreateStreamDataReads: Reads[ApiCreateStreamData] = (
    (JsPath \ "name").read[String](nameValidate) and
      (JsPath \ "uri").read[String] and
      (JsPath \ "status").readNullable[ApiSetStatusData]
    )(ApiCreateStreamData.apply _)
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

  /**
   * Lookup all streams using an optional query.
   */
  def apiGetStreams(): Action[AnyContent] = Action { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    toResponse(StreamApi.apiGetStreams(query))
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
        toResponse(StreamApi.apiCreateStream(request.user, value.name, value.uri, value.status))
      },
      invalid = e =>
        BadRequest(Json.toJson(ApiError("Could not process request", e))))
  }

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(id: String): Action[Unit] = AuthorizedAction(parse.empty) { implicit request =>
    toResponse(models.Stream.findById(id) map { stream =>
      StreamApi.apiDeleteStream(request.user, stream)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist."))))
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
    toResponse(StreamApi.apiSetStreamStatus(request.user, id, request.body))
  }

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
      StreamApi.apiGetChildren(stream, query, 20, 0).map(toResponse(_))
    } getOrElse (Future.successful(NotFound(Json.toJson(ApiError("Stream does not exist.")))))
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
    } yield Ok(Json.toJson(child))) getOrElse {
      NotFound(Json.toJson(ApiError("Stream does not exist.")))
    }
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
        models.Stream.asOwner(parent, user) map { ownedStream =>
          if (childData.hierarchical)
            UnprocessableEntity(Json.toJson(ApiError("Cannot remove hierarchical child.")))
          else {
            removeChild(ownedStream, child)
            Ok("")
          }
        } getOrElse Unauthorized(Json.toJson(ApiError("User does not have permission to edit stream."))))
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
        toResponse(StreamApi.apiCreateChild(request.user, parent, childId))
    } getOrElse {
      NotFound(Json.toJson(ApiError("Parent stream does not exist.")))
    }
  }}

  /**
   * Get all tags associated with a given stream.
   */
  def getTags(streamId: String) = Action { implicit request =>
    toResponse(StreamApi.getTags(streamId))
  }

  /**
   * Update the tags associated with a given stream.
   */
  def setTags(streamId: String) = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiSetTagsData](request.body) map { tags =>
      toResponse(StreamApi.setTags(request.user, streamId, tags))
    } recoverTotal { e =>
      UnprocessableEntity(Json.toJson(ApiError("Could not process request.", e)))
    }
  }

  /**
   * Lookup a tag on a given stream.
   */
  def getTag(streamId: String, tag: String) = Action { implicit request =>
    toResponse(StreamApi.getTag(streamId, tag))
  }

  /**
   * Set a tag on a given stream.
   */
  def setTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.setTag(request.user, streamId, tag))
  }

  /**
   * Remove a tag on a given stream.
   */
  def removeTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.removeTag(request.user, streamId, tag))
  }

  def addChild(parent: models.Stream.OwnedStream, heirarchical: Boolean, child: models.Stream): Option[models.Stream] =
    if (parent.stream.childCount < models.Stream.maxChildren)
      parent.addChild(heirarchical, child) map { newChildData =>
        StreamSupervisor.addChild(parent.stream, child)
        child
      }
    else
      None

  private def removeChild(parent: models.Stream.OwnedStream, child: models.Stream): Option[models.Stream] = {
    models.Stream.removeChild(parent.stream, child.id)
    StreamSupervisor.removeChild(parent.stream.uri, child.uri)
    Some(child)
  }
}

