package api

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.utils.UriEncoding
import scala.collection.immutable.{List}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

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
object StreamApi {
  /**
   * Lookup a stream.
   */
  def getStream(key: models.StreamKey): ApiResult[models.Stream] =
    models.Stream.findByKey(key) map { stream =>
      ApiOk(stream)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Lookup multiple streams with an optional query.
   *
   * If not query is provided, searches using status, tag, or by name.
   */
  def getStreams(query: String): ApiResult[Seq[models.Stream]] =
    models.StreamQuery.fromString(query) map {
      getStreams(_)
    } getOrElse {
      ApiOk(models.Stream.findByUpdated())
    }

  def getStreams(query: models.StreamQuery): ApiResult[Seq[models.Stream]] =
    models.Color.fromString(query.value) map { color =>
      ApiOk(models.Stream.findByStatus(color))
    } orElse {
      Some(query.value)
        .filter(_.startsWith("#"))
        .flatMap(tag => models.StreamTag.fromString(tag.substring(1)))
        .map { tag =>
        ApiOk(models.Stream.getStreamWithTag(tag, 20))
      }
    } getOrElse {
      ApiOk(models.Stream.findByQuery(query))
    }

  /**
   * Get the status of a stream.
   */
  def getStreamStatus(key: models.StreamKey): ApiResult[models.Status] =
    models.Stream.findByKey(key) map { stream =>
      ApiOk(stream.status)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Get a child of a stream.
   */
  def getChild(parentKey: models.StreamKey, childKey: models.StreamKey): ApiResult[models.Stream] =
    (for {
      childData <- models.Stream.getChildById(parentKey, childKey)
      child <- models.Stream.findById(childData.childId)
    } yield ApiOk(child)) getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Create a new stream.
   *
   * Cannot create root streams.
   */
  def createStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData], tags: Option[Seq[models.StreamTag]]): ApiResult[models.Stream] =
    models.StreamName.fromString(name) map { validatedName =>
      StreamHelper.getParentFromPath(uri) map { case (parent, childUri) =>
        if (!models.StreamUri.fromName(validatedName).value.equalsIgnoreCase(childUri.value))
          ApiCouldNotProccessRequest(ApiError("Stream name and uri do not match."))
        else
          createStream(user, parent, uri, validatedName, status, tags)
      } getOrElse {
        ApiNotFound(ApiError("Parent stream does not exist."))
      }
    } getOrElse {
      ApiCouldNotProccessRequest(ApiError("Stream name is invalid."))
    }

  def createStream(user: models.User, parent: models.Stream, uri: String, validatedName: models.StreamName, status: Option[ApiSetStatusData], tags: Option[Seq[models.StreamTag]]): ApiResult[models.Stream] =
    models.Stream.asOwner(parent, user) map { parent =>
      createStream(parent, uri, validatedName, status, tags)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add child."))
    }

  def createStream(parent: models.Stream.OwnedStream, uri: String, validatedName: models.StreamName, status: Option[ApiSetStatusData], tags: Option[Seq[models.StreamTag]]): ApiResult[models.Stream] =
    models.Stream.findByUri(uri).flatMap(models.Stream.asOwner(_, parent.user)) map { existing =>
      updateStream(existing, status, tags)
      ApiOk(existing.stream)
    } getOrElse {
      if (parent.stream.childCount >= models.Stream.maxChildren) {
        ApiCouldNotProccessRequest(ApiError("Too many children."))
      } else if (parent.user.streamCount >= models.User.streamLimit) {
        ApiCouldNotProccessRequest(ApiError("Too many streams for user."))
      } else {
        createDescendant(parent, validatedName) map { newStream =>
          updateStream(newStream, status, tags)
          ApiCreated(newStream.stream)
        } getOrElse {
          ApiInternalError()
        }
      }
    }

  private def updateStream(stream: models.Stream.OwnedStream, status: Option[ApiSetStatusData], tags: Option[Seq[models.StreamTag]]): Option[models.Stream] =
    Some(stream)
      .flatMap(_ => status flatMap { s => updateStreamStatus(stream, s.color) } orElse { Some(stream) })
      .flatMap { _ =>
        tags flatMap { tags =>
          setTags(stream, tags) match {
            case ApiSuccess(_) => Some(stream.stream)
            case ApiFailure(_) => None
          }
        }
      }

  /**
   * Delete an existing stream.
   *
   * Cannot delete root streams.
   */
  def apiDeleteStream(user: models.User, key: models.StreamKey): ApiResult[models.Stream] =
    models.Stream.findByKey(key) map { stream =>
      apiDeleteStream(user, stream)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def apiDeleteStream(user: models.User, stream: models.Stream): ApiResult[models.Stream] =
    models.Stream.asOwner(stream, user) map { ownedStream =>
      if (ownedStream.stream.name.equalsIgnoreCase(ownedStream.stream.uri)) {
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
  def setStreamStatus(user: models.User, key: models.StreamKey, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.findByKey(key) map { stream =>
      setStreamStatus(user, stream, status)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def setStreamStatus(user: models.User, stream: models.Stream, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.asOwner(stream, user) map { stream =>
      updateStreamStatus(stream, status.color) map { stream =>
        ApiOk(stream.status)
      } getOrElse {
        ApiInternalError()
      }
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to edit stream."))
    }

  /**
   * Get children of a stream.
   *
   * Returns either the most recent children or children from the query
   *
   * TODO: normally should return list of ids which query params can expand to stream?
   */
  def getChildren(key: models.StreamKey, query: String, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    models.Stream.findByKey(key) map {
      getChildren(_, query, limit, offset)
    } getOrElse {
      Future.successful(ApiNotFound(ApiError("Stream does not exist.")))
    }

  def getChildren(stream: models.Stream, query: String, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    models.StreamQuery.fromString(query) map { query =>
      Future.successful(getChildren(stream, query, limit, offset))
    } getOrElse {
      getChildren(stream, limit, offset)
    }

  def getChildren(stream: models.Stream, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    CollectionSupervisor.getStreamCollection(stream.getUri(), limit, offset) map { children =>
      ApiOk(children.flatMap(models.Stream.findByUri(_)))
    }

  def getChildren(parent: models.Stream, query: models.StreamQuery, limit: Int, offset: Int): ApiResult[Seq[models.Stream]] =
    models.Color.fromString(query.value) map { color =>
      ApiOk(models.Stream.getChildrenByStatus(parent, color, 20))
    } orElse {
      Some(query.value)
        .filter(_.startsWith("#"))
        .flatMap(tag => models.StreamTag.fromString(tag.substring(1)))
        .map { tag =>
          ApiOk(models.Stream.getChildrenWithTag(parent, tag, 20))
       }
    } getOrElse {
      ApiOk(models.Stream.getChildrenByQuery(parent, query, limit))
    }

  /**
   * Link an existing stream as a child of a stream.
   *
   * Noop if the child already exists.
   */
  def createChild(user: models.User, parentKey: models.StreamKey, childKey: models.StreamKey): ApiResult[models.Stream] =
    models.Stream.findByKey(parentKey) map { parent =>
      if (parent.childCount >= models.Stream.maxChildren)
        ApiCouldNotProccessRequest(ApiError("Too many children."))
      else
        createChild(user, parent, childKey)
    } getOrElse {
      ApiNotFound(ApiError("Parent stream does not exist."))
    }

  def createChild(user: models.User, parent: models.Stream, childKey: models.StreamKey): ApiResult[models.Stream] =
    models.Stream.asOwner(parent, user) map { parent =>
      createChild(parent, childKey)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add child."))
    }

  def createChild(parent: models.Stream.OwnedStream, childKey: models.StreamKey): ApiResult[models.Stream] =
    models.Stream.findByKey(childKey) map { child =>
      createChild(parent, child)
    } getOrElse {
      ApiNotFound(ApiError("Child stream does not exist."))
    }

  def createChild(parent: models.Stream.OwnedStream, child: models.Stream): ApiResult[models.Stream] =
    if (parent.stream.id == child.id)
      ApiCouldNotProccessRequest(ApiError("I'm my own grandpa."))
    else
      models.Stream.getChildById(parent.stream.id, child.id) map { _ =>
        ApiOk(child)
      } orElse {
        addChild(parent, false, child) map { _ =>
          ApiCreated(child)
        }
      } getOrElse {
        ApiInternalError()
      }

  /**
   * Remove a linked child stream.
   *
   * Does not delete the target stream and cannot be used to delete hierarchical children.
   */
  def apiDeleteChild(user: models.User, parentKey: models.StreamKey, childKey: models.StreamKey): ApiResult[models.Stream] =
    (for {
      parent <- models.Stream.findByKey(parentKey)
      childData <- models.Stream.getChildById(parentKey, childKey)
      child <- models.Stream.findByKey(childKey)
    } yield
        models.Stream.asOwner(parent, user) map { ownedStream =>
          if (childData.hierarchical)
            ApiCouldNotProccessRequest(ApiError("Cannot remove hierarchical child."))
          else {
            removeChild(ownedStream, child)
            ApiOk(child)
          }
        } getOrElse ApiUnauthroized(ApiError("User does not have permission to edit stream."))
      ) getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  /**
   * Get the tags for a given stream.
   */
  def getTags(streamKey: models.StreamKey): ApiResult[Seq[models.StreamTag]] =
    models.Stream.findByKey(streamKey) map { stream =>
      ApiOk(stream.getTags())
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Update the tags associated with a given stream.
   */
  def setTags(user: models.User, streamKey: models.StreamKey, tags: Seq[models.StreamTag]) : ApiResult[Seq[models.StreamTag]] =
    models.Stream.findByKey(streamKey) map {
      setTags(user, _, tags)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def setTags(user: models.User, stream: models.Stream, tags: Seq[models.StreamTag]) : ApiResult[Seq[models.StreamTag]] =
    models.Stream.asOwner(stream, user) map {
      setTags(_, tags)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add tags."))
    }

  def setTags(stream: models.Stream.OwnedStream, tags: Seq[models.StreamTag]) : ApiResult[Seq[models.StreamTag]] = {
    if (tags.size > models.Stream.maxTags) {
      ApiCouldNotProccessRequest(ApiError("Too many tags."))
    } else if (tags.distinct.size != tags.size) {
      ApiCouldNotProccessRequest(ApiError("Duplicate tags not allowed."))
    } else {
      doSetTags(stream, tags)
      ApiOk(stream.stream.getTags())
    }
  }

  /**
   * Lookup a tag on a given stream.
   */
  def getTag(streamKey: models.StreamKey, tag: String): ApiResult[models.StreamTag] =
    models.Stream.findByKey(streamKey) map { stream =>
      getTag(stream, tag)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def getTag(stream: models.Stream, tag: String): ApiResult[models.StreamTag] =
    stream.getTags()
      .find(streamTag => streamTag.value == tag)
      .map(tag => ApiOk(tag))
      .getOrElse(ApiNotFound(ApiError("Tag does not exist.")))

  /**
   * Change the tags on a stream.
   */
  private def modifyTags[R](user: models.User, streamKey: models.StreamKey)(modify: (models.Stream.OwnedStream) => ApiResult[R]): ApiResult[R] =
    models.Stream.findByKey(streamKey) map {
      modifyTags(user, _)(modify)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  private def modifyTags[R](user: models.User, stream: models.Stream)(modify: (models.Stream.OwnedStream) => ApiResult[R]): ApiResult[R] =
    models.Stream.asOwner(stream, user) map {
      modify(_)
    } getOrElse {
      ApiNotFound(ApiError("User does not have permission to edit stream."))
    }

  /**
   * Add a tag to a stream.
   */
  def setTag(user: models.User, streamKey: models.StreamKey, tag: String): ApiResult[models.StreamTag] =
    models.StreamTag.fromString(tag) map {
      setTag(user, streamKey, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  def setTag(user: models.User, streamKey: models.StreamKey, tag: models.StreamTag): ApiResult[models.StreamTag] =
    modifyTags(user, streamKey) { stream =>
      if (stream.stream.hasTag(tag)) {
        ApiOk(tag)
      } else if (stream.stream.tags.size >= models.Stream.maxTags) {
        ApiCouldNotProccessRequest(ApiError("Too many tags."))
      } else {
        doSetTags(stream, stream.stream.getTags() :+ tag)
        ApiCreated(tag)
      }
    }

  /**
   * Remove a tag on a given stream.
   */
  def removeTag(user: models.User, streamKey: models.StreamKey, tag: String): ApiResult[models.StreamTag] =
    models.StreamTag.fromString(tag) map {
      setTag(user, streamKey, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  def removeTag(user: models.User, streamKey: models.StreamKey, tag: models.StreamTag): ApiResult[models.StreamTag] =
    modifyTags(user, streamKey) { stream =>
      if (!stream.stream.hasTag(tag)) {
        ApiNotFound(ApiError("No such tag."))
      } else {
        doSetTags(stream, stream.stream.getTags() diff List(tag))
        ApiOk(tag)
      }
    }

  /**
   * Update the status of a stream
   */
  private def updateStreamStatus(stream: models.Stream.OwnedStream, color: models.Color): Option[models.Stream] =
    stream.updateStatus(color) map { s =>
      StreamSupervisor.updateStatus(s, s.status)
      s
    }

  private def addChild(parent: models.Stream.OwnedStream, hierarchical: Boolean, child: models.Stream): Option[models.Stream] =
    if (parent.stream.childCount < models.Stream.maxChildren)
      parent.addChild(hierarchical, child) map { newChildData =>
        StreamSupervisor.addChild(parent.stream, child)
        child
      }
    else
      None

  private def createDescendant(parent: models.Stream.OwnedStream, name: models.StreamName): Option[models.Stream.OwnedStream] =
    parent.createDescendant(name) flatMap { newChild =>
      addChild(parent, true, newChild)
    } flatMap { child =>
      models.Stream.asOwner(child, parent.user)
    }

  private def removeChild(parent: models.Stream.OwnedStream, child: models.Stream): Option[models.Stream] = {
    parent.removeChild(child.id)
    StreamSupervisor.removeChild(parent.stream.getUri(), child.getUri())
    Some(child)
  }

  private def removeChild(childData: models.ChildStream): Unit = {
    models.Stream.removeChild(childData)
    StreamSupervisor.removeChild(childData.getParentUri(), childData.getChildUri())
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
    StreamSupervisor.deleteStream(stream.getUri())
  }

  /**
   * Perform a tag update.
   */
  private def doSetTags(stream: models.Stream.OwnedStream, tags: Seq[models.StreamTag]): Option[models.Stream] = {
    StreamSupervisor.addedTags(stream.stream, tags diff stream.stream.getTags())
    StreamSupervisor.removedTags(stream.stream, stream.stream.getTags() diff tags)
    stream.setTags(tags)
  }
}