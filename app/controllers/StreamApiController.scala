package controllers

import api._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

/** Stream REST api controller. */
object StreamApiController extends Controller {
  /** Convert an API result into a HTTP response. */
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
    toResponse(StreamApi.getStream(models.StreamKey.forId(id)))
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
    toResponse(StreamApi.getStreamStatus(models.StreamKey.forId(id)))
  }

  /**
    * Set the status of a stream.
    */
  def apiSetStreamStatus(id: String) = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiSetStatusData](request.body) map { status =>
      toResponse(StreamApi.setStreamStatus(request.user, models.StreamKey.forId(id), status))
    } recoverTotal { e =>
      BadRequest(Json.toJson(ApiError("Could not process request", e)))
    }
  }

  /**
    * Create a new stream
    *
    * Cannot create root streams.
    */
  def apiCreateStream() = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiCreateStreamData](request.body) map { value =>
      toResponse(StreamApi.createStream(request.user, value.name, value.uri, value.status, value.tags.map(_.tags)))
    } recoverTotal { e =>
      BadRequest(Json.toJson(ApiError("Could not process request", e)))
    }
  }

  /**
    * Delete an existing stream.
    *
    * Cannot delete root streams.
    */
  def apiDeleteStream(id: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.apiDeleteStream(request.user, models.StreamKey.forId(id)))
  }

  /**
    * Get children of a stream.
    *
    * Returns either the most recent children or children from the query
    */
  def apiGetChildren(streamId: String) = Action.async { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    StreamApi.getChildren(models.StreamKey.forId(streamId), query, 20, 0).map(toResponse(_))
  }

  /**
    * Get a child of a stream.
    */
  def apiGetChild(parentId: String, childId: String) = Action { implicit request =>
    toResponse(StreamApi.getChild(models.StreamKey.forId(parentId), models.StreamKey.forId(childId)))
  }

  /**
    * Remove a linked child stream.
    *
    * Does not delete the target stream and cannot be used to delete hierarchical children.
    */
  def apiDeleteChild(parentId: String, childId: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.apiDeleteChild(request.user, models.StreamKey.forId(parentId), models.StreamKey.forId(childId)))
  }

  /**
    * Link an existing stream as a child of a stream.
    *
    * Noop if the child already exists.
    */
  def apiCreateChild(parentId: String, childId: String) = AuthorizedAction { implicit request => {
    toResponse(StreamApi.createChild(request.user, models.StreamKey.forId(parentId), models.StreamKey.forId(childId)))
  }
  }

  /**
    * Get all tags associated with a given stream.
    */
  def getTags(streamId: String) = Action { implicit request =>
    toResponse(StreamApi.getTags(models.StreamKey.forId(streamId)))
  }

  /**
    * Update the tags associated with a given stream.
    */
  def setTags(streamId: String) = AuthorizedAction(parse.json) { implicit request =>
    Json.fromJson[ApiSetTagsData](request.body) map { tags =>
      toResponse(StreamApi.setTags(request.user, models.StreamKey.forId(streamId), tags.tags))
    } recoverTotal { e =>
      UnprocessableEntity(Json.toJson(ApiError("Could not process request.", e)))
    }
  }

  /**
    * Lookup a tag on a given stream.
    */
  def getTag(streamId: String, tag: String) = Action { implicit request =>
    toResponse(StreamApi.getTag(models.StreamKey.forId(streamId), tag))
  }

  /**
    * Set a tag on a given stream.
    */
  def setTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.setTag(request.user, models.StreamKey.forId(streamId), tag))
  }

  /**
    * Remove a tag on a given stream.
    */
  def removeTag(streamId: String, tag: String) = AuthorizedAction { implicit request =>
    toResponse(StreamApi.removeTag(request.user, models.StreamKey.forId(streamId), tag))
  }

  /**
    * Lookup all streams with a given tag.
    */
  def getTagChildren(tag: String) = Action.async { implicit request =>
    val query = request.getQueryString("query").getOrElse("")
    TagApi.getTagChildren(tag, query, 20, 0).map(toResponse(_))
  }
}
