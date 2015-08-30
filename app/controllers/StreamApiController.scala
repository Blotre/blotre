package controllers

import api._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

/**
 * Stream REST api controller.
 */
object StreamApiController extends Controller
{
  /**
   * Convert an API result into a HTTP response.
   */
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
   * Lookup a stream by id.
   */
  def apiGetStream(id: String) = Action { implicit request =>
    toResponse(StreamApi.getStream(id))
  }

  /**
   * Lookup streams using an optional query.
   */
  def apiGetStreams() = Action { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    toResponse(StreamApi.getStreams(query))
  }

  /**
   * Get the status of a stream.
   */
  def apiGetStreamStatus(id: String) = Action { implicit request =>
    toResponse(StreamApi.getStreamStatus(id))
  }

  /**
   * Set the status of a stream.
   */
  def apiSetStreamStatus(id: String) = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiSetStatusData](request.body) map { status =>
      toResponse(StreamApi.setStreamStatus(request.user, id, status))
    } recoverTotal { e =>
      BadRequest(Json.toJson(ApiError("Could not process request", e)))
    }
  }

  /**
   * Create a new stream.
   *
   * Cannot create root streams.
   */
  def apiCreateStream() = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiCreateStreamData](request.body) map { value =>
      toResponse(StreamApi.createStream(request.user, value.name, value.uri, value.status))
    } recoverTotal  { e =>
      BadRequest(Json.toJson(ApiError("Could not process request", e)))
    }
  }

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(id: String) = AuthorizedAction { implicit request =>
    toResponse(models.Stream.findById(id) map { stream =>
      StreamApi.apiDeleteStream(request.user, stream)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    })
  }

  /**
   * Get children of a stream.
   *
   * Returns either the most recent children or children from the query
   *
   * TODO: normally should return list of ids which query params can expand to stream?
   */
  def apiGetChildren(id: String) = Action.async { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    StreamApi.getChildren(id, query, 20, 0).map(toResponse(_))
  }

  /**
   * Get a child of a stream.
   */
  def apiGetChild(parentId: String, childId: String) = Action { implicit request =>
    toResponse(StreamApi.getChild(parentId, childId))
  }

  /**
   * Remove a linked child stream.
   *
   * Does not delete the target stream and cannot be used to delete hierarchical children.
   */
  def apiDeleteChild(parentId: String, childId: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.apiDeleteChild(request.user, parentId, childId))
  }

  /**
   * Link an existing stream as a child of a stream.
   *
   * Noop if the child already exists.
   */
  def apiCreateChild(parentId: String, childId: String) = AuthorizedAction { implicit request => {
    toResponse(StreamApi.createChild(request.user, parentId, childId))
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
      toResponse(StreamApi.setTags(request.user, streamId, tags.tags))
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
    toResponse(StreamApi.addTag(request.user, streamId, tag))
  }

  /**
   * Remove a tag on a given stream.
   */
  def removeTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.removeTag(request.user, streamId, tag))
  }

  /**
   * Lookup all streams with a given tag.
   */
  def getTagChildren(tag: String) = Action.async { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    TagApi.getTagChildren(tag, query, 20, 0).map(toResponse(_))
  }
}

