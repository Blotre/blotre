package controllers

import Actors.{StreamSupervisor, CollectionSupervisor}
import play.api.libs.json.{Json, JsValue}
import play.utils.UriEncoding

import scala.collection.immutable.{Seq, List}
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

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
    for (
      uri <- models.StreamUri.fromString(uri);
      paths <- getRawParentPath(uri.value);
      parentPath <- models.StreamUri.fromString(paths._2)
    ) yield {
      (paths._1, parentPath)
    }
}

/**
 * Stream api.
 */
object StreamApi
{
  private def createDescendant(parent: models.Stream.OwnedStream, name: models.StreamName): Option[models.Stream] =
    parent.createDescendant(name) flatMap { newChild =>
      addChild(parent, true, newChild)
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
   * Create a new stream.
   *
   * Cannot create root streams.
   */
  def apiCreateStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
    models.StreamName.fromString(name) map { validatedName =>
      StreamHelper.getParentFromPath(uri) map { case (parent, childUri) =>
        if (!(models.StreamUri.fromName(validatedName).value.equalsIgnoreCase(childUri.value)))
          ApiCouldNotProccessRequest(ApiError("Stream name and uri do not match."))
        else
          apiCreateStream(user, parent, uri, validatedName, status)
      } getOrElse (ApiNotFound(ApiError("Parent stream does not exist.")))
    } getOrElse {
      ApiCouldNotProccessRequest(ApiError("Stream name is invalid."))
    }

  private def apiCreateStream(user: models.User, parent: models.Stream, uri: String, validatedName: models.StreamName, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
    models.Stream.asOwner(parent, user) map { parent =>
      models.Stream.findByUri(uri).flatMap(models.Stream.asOwner(_, user)) map { existing =>
        status.map(s => updateStreamStatus(existing, s.color))
        ApiOk(existing.stream)
      } getOrElse {
        if (parent.stream.childCount >= models.Stream.maxChildren)
          ApiCouldNotProccessRequest(ApiError("Too many children."))
        else if (user.streamCount >= models.User.streamLimit)
          ApiCouldNotProccessRequest(ApiError("Too many streams for user."))
        else
          createDescendant(parent, validatedName).flatMap(models.Stream.asOwner(_, user)) map { newStream =>
            status.map(s => updateStreamStatus(newStream, s.color))
            ApiCreated(newStream.stream)
          } getOrElse (ApiInternalError())
      }
    } getOrElse (ApiUnauthroized(ApiError("User does not have permission to add child.")))

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(user: models.User, uri: String): ApiResult[models.Stream] =
    models.Stream.findByUri(uri) map { stream =>
      apiDeleteStream(user, stream)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  def apiDeleteStream(user: models.User, stream: models.Stream): ApiResult[models.Stream] =
    models.Stream.asOwner(stream, user) map { ownedStream =>
      if (ownedStream.stream.name == ownedStream.stream.uri) {
        ApiCouldNotProccessRequest(ApiError("Cannot delete root streams."))
      } else {
        deleteStream(stream)
        ApiOk(stream)
      }
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to delete stream."))
    }

  /**
   * Set the status of a stream.
   */
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
    models.Stream.asOwner(stream, user) map { stream =>
      updateStreamStatus(stream, status.color) map { stream =>
        ApiOk(stream)
      } getOrElse (ApiInternalError())
    } getOrElse (ApiUnauthroized(ApiError("User does not have permission to edit stream.")))

  /**
   * Get children of a stream.
   *
   * Returns either the most recent children or children from the query
   *
   * TODO: normally should return list of ids which query params can expand to stream?
   */
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
   *
   */
  def apiCreateChild(user: models.User, parent: models.Stream, childId: String): ApiResult[models.Stream] =
    models.Stream.asOwner(parent, user) map { parent =>
      apiCreateChild(parent, childId)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add child."))
    }

  def apiCreateChild(parent: models.Stream.OwnedStream, childId: String): ApiResult[models.Stream] =
    models.Stream.findById(childId) map { child =>
      apiCreateChild(parent, child)
    } getOrElse {
      ApiNotFound(ApiError("Child stream does not exist."))
    }

  def apiCreateChild(parent: models.Stream.OwnedStream, child: models.Stream): ApiResult[models.Stream] =
    if (parent.stream.id == child.id)
      ApiCouldNotProccessRequest(ApiError("I'm my own grandpa."))
    else
      models.Stream.getChildById(parent.stream.id, child.id) map { _ =>
        ApiOk(child)
      } orElse {
        addChild(parent, false, child) map { _ =>
          ApiCreated(child)
        }
      } getOrElse (ApiInternalError())

  /**
   * Update the tags associated with a given stream.
   */
  private def setTagsInternal(user: models.User, stream: models.Stream, body: JsValue): ApiResult[models.Stream] =
    Json.fromJson[ApiSetTagsData](body) map { tags =>
      setTagsInternal(user, stream, tags)
    } recoverTotal { e =>
      ApiCouldNotProccessRequest(ApiError("Could not process request.", e))
    }

  private def setTagsInternal(user: models.User, stream: models.Stream, data: ApiSetTagsData) : ApiResult[models.Stream] =
    models.Stream.asOwner(stream, user) map { parent =>
      doSetTags(stream, data.tags)
      ApiOk(stream)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add tags."))
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
   *
   */
  private def updateStreamStatus(stream: models.Stream.OwnedStream, color: models.Color): Option[models.Status] =
    stream.updateStatus(color) map { s =>
      StreamSupervisor.updateStatus(s, s.status)
      s.status
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