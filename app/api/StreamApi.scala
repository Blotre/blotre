package api

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.api.data.validation.ValidationError
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.utils.UriEncoding

import scala.collection.immutable.{List, Seq}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

/**
 *
 */
case class ApiSetStatusData(color: models.Color)

object ApiSetStatusData
{
  implicit val apiSetStatusDataReads: Reads[ApiSetStatusData] =
    (__ \ "color")
      .read(models.Color.readColor)
      .map(ApiSetStatusData.apply(_))
}

/**
 *
 */
case class ApiSetTagsData(tags: Seq[models.StreamTag])

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


object ApiSetTagsData
{
  implicit val streamTagReads: Reads[models.StreamTag] =
    Reads.StringReads
      .map(models.StreamTag.fromString)
      .filter(ValidationError("Tag is not valid."))(_.isDefined)
      .map(_.get)

  implicit val apiSetStatusDataReads: Reads[ApiSetTagsData] =
    Reads.list[models.StreamTag]
      .filter(ValidationError("Too many tags."))(tags => tags.size <= models.Stream.maxTags)
      .filter(ValidationError("Duplicate tags not allowed."))(tags => tags.distinct.size == tags.size)
      .map(ApiSetTagsData(_))
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
  import models.Serializable._

  /**
   * Lookup a stream by Id
   */
  def getStream(id: String): ApiResult[models.Stream] =
    models.Stream.findById(id) map { stream =>
      ApiOk(stream)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Lookup multiple streams.
   */
  def getStreams(query: String): ApiResult[JsValue] = {
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
   * Get the status of a stream.
   */
  def getStreamStatus(id: String): ApiResult[models.Status] =
    models.Stream.findById(id) map { stream =>
      ApiOk(stream.status)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Get a child of a stream.
   */
  def getChild(parentId: String, childId: String): ApiResult[models.Stream] =
    (for {
      parent <- stringToObjectId(parentId);
      child <- stringToObjectId(childId);
      childData <- models.Stream.getChildById(parent, child);
      child <- models.Stream.findById(childData.childId)
    } yield ApiOk(child)) getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Create a new stream.
   *
   * Cannot create root streams.
   */
  def createStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
    models.StreamName.fromString(name) map { validatedName =>
      StreamHelper.getParentFromPath(uri) map { case (parent, childUri) =>
        if (!(models.StreamUri.fromName(validatedName).value.equalsIgnoreCase(childUri.value)))
          ApiCouldNotProccessRequest(ApiError("Stream name and uri do not match."))
        else
          createStream(user, parent, uri, validatedName, status)
      } getOrElse (ApiNotFound(ApiError("Parent stream does not exist.")))
    } getOrElse {
      ApiCouldNotProccessRequest(ApiError("Stream name is invalid."))
    }

  def createStream(user: models.User, parent: models.Stream, uri: String, validatedName: models.StreamName, status: Option[ApiSetStatusData]): ApiResult[models.Stream] =
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
  def setStreamStatus(user: models.User, id: String, body: JsValue): ApiResult[models.Status] =
    Json.fromJson[ApiSetStatusData](body) map { status =>
      setStreamStatus(user, id, status)
    } recoverTotal { e =>
      ApiCouldNotProccessRequest(ApiError("Could not process request.", e))
    }

  def setStreamStatus(user: models.User, streamId: String, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.findById(streamId) map { stream =>
      setStreamStatus(user, stream, status)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def apiSetStreamStatusForUri(user: models.User, streamUri: String, status: ApiSetStatusData): ApiResult[models.Status]  =
    models.Stream.findByUri(streamUri) map { stream =>
      setStreamStatus(user, stream, status)
    } getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  def setStreamStatus(user: models.User, stream: models.Stream, status: ApiSetStatusData): ApiResult[models.Status]  =
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
  def getChildren(uri: String, query: String, limit: Int, offset: Int): Future[ApiResult[List[models.Stream]]] =
    models.Stream.findByUri(uri) map { stream =>
      getChildren(stream, query, limit, offset)
    } getOrElse {
      Future.successful(ApiNotFound(ApiError("Stream does not exist.")))
    }

  def getChildren(stream: models.Stream, query: String, limit: Int, offset: Int): Future[ApiResult[List[models.Stream]]] =
    if (query.isEmpty) {
      // Get most recently updated children
      CollectionSupervisor.getStreamCollection(stream.getUri(), limit, offset) map { children =>
        ApiOk(children.map(models.Stream.findByUri(_)).flatten[models.Stream])
      }
    } else {
      // Lookup children using query
      Future.successful(ApiOk(models.Stream.getChildrenByQuery(stream, query, limit)))
    }
  
  /**
   * Link an existing stream as a child of a stream.
   *
   * Noop if the child already exists.
   */
  def createChild(user: models.User, parentId: String, childId: String): ApiResult[models.Stream] =
    models.Stream.findById(parentId) map { parent =>
      if (parent.childCount >= models.Stream.maxChildren)
        ApiCouldNotProccessRequest(ApiError("Too many children."))
      else
        createChild(user, parent, childId)
    } getOrElse {
      ApiNotFound(ApiError("Parent stream does not exist."))
    }

  def createChild(user: models.User, parent: models.Stream, childId: String): ApiResult[models.Stream] =
    models.Stream.asOwner(parent, user) map { parent =>
      createChild(parent, childId)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add child."))
    }

  def createChild(parent: models.Stream.OwnedStream, childId: String): ApiResult[models.Stream] =
    models.Stream.findById(childId) map { child =>
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
      } getOrElse (ApiInternalError())

  /**
   * Remove a linked child stream.
   *
   * Does not delete the target stream and cannot be used to delete hierarchical children.
   */
  def apiDeleteChild(user: models.User, parentId: String, childId: String): ApiResult[models.Stream] =
    (for {
      parentId <- stringToObjectId(parentId);
      childId <- stringToObjectId(childId);
      parent <- models.Stream.findById(parentId);
      childData <- models.Stream.getChildById(parentId, childId)
      child <- models.Stream.findById(childId)
    } yield (
        models.Stream.asOwner(parent, user) map { ownedStream =>
          if (childData.hierarchical)
            ApiCouldNotProccessRequest(ApiError("Cannot remove hierarchical child."))
          else {
            removeChild(ownedStream, child)
            ApiOk(child)
          }
        } getOrElse ApiUnauthroized(ApiError("User does not have permission to edit stream.")))
      ) getOrElse (ApiNotFound(ApiError("Stream does not exist.")))

  /**
   * Get the tags for a given stream.
   */
  def getTags(streamId: String): ApiResult[Seq[models.StreamTag]] =
    models.Stream.findById(streamId) map { stream =>
      ApiOk(stream.getTags)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  /**
   * Update the tags associated with a given stream.
   */
  def setTags(user: models.User, streamId: String, data: ApiSetTagsData) : ApiResult[models.Stream] =
    models.Stream.findById(streamId) map {
      setTags(user, _, data)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def setTags(user: models.User, stream: models.Stream, data: ApiSetTagsData) : ApiResult[models.Stream] =
    models.Stream.asOwner(stream, user) map {
      setTags(_, data)
    } getOrElse {
      ApiUnauthroized(ApiError("User does not have permission to add tags."))
    }

  def setTags(stream: models.Stream.OwnedStream, data: ApiSetTagsData) : ApiResult[models.Stream] = {
    doSetTags(stream, data.tags)
    ApiOk(stream.stream)
  }

  /**
   * Lookup a tag on a given stream.
   */
  def getTag(streamId: String, tag: String): ApiResult[String] =
    models.Stream.findById(streamId) map { stream =>
      getTag(stream, tag)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  def getTag(stream: models.Stream, tag: String): ApiResult[String] =
    stream.getTags()
      .filter(streamTag => streamTag.value == tag)
      .headOption
      .map(tag => ApiOk(tag.value))
      .getOrElse(ApiNotFound(ApiError("Tag does not exist.")))

  /**
   * Change the tags on a stream.
   */
  private def modifyTags(user: models.User, streamId: String)(modify: (models.Stream.OwnedStream) => ApiResult[String]): ApiResult[String] =
    models.Stream.findById(streamId) map {
      modifyTags(user, _)(modify)
    } getOrElse {
      ApiNotFound(ApiError("Stream does not exist."))
    }

  private def modifyTags(user: models.User, stream: models.Stream)(modify: (models.Stream.OwnedStream) => ApiResult[String]): ApiResult[String] =
    models.Stream.asOwner(stream, user) map {
      modify(_)
    } getOrElse {
      ApiNotFound(ApiError("User does not have permission to edit stream."))
    }

  /**
   * r a tag to a stream.
   */
  def addTag(user: models.User, streamId: String, tag: String): ApiResult[String] =
    models.StreamTag.fromString(tag) map {
      addTag(user, streamId, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  def addTag(user: models.User, streamId: String, tag: models.StreamTag): ApiResult[String] =
    modifyTags(user, streamId) { stream =>
      if (stream.stream.hasTag(tag))
        ApiOk(tag.value)
      else {
        stream.setTags(stream.stream.getTags() :+ tag)
        ApiCreated(tag.value)
      }
    }

  /**
   * Remove a tag on a given stream.
   */
  def removeTag(user: models.User, streamId: String, tag: String): ApiResult[String] =
    models.StreamTag.fromString(tag) map {
      addTag(user, streamId, _)
    } getOrElse {
      ApiNotFound(ApiError("Tag is not valid."))
    }

  def removeTag(user: models.User, streamId: String, tag: models.StreamTag): ApiResult[String] =
    modifyTags(user, streamId) { stream =>
      if (!stream.stream.hasTag(tag))
        ApiOk("")
      else {
        stream.setTags(stream.stream.getTags() diff List(tag))
        ApiOk(tag.value)
      }
    }

  /**
   *
   */
  private def updateStreamStatus(stream: models.Stream.OwnedStream, color: models.Color): Option[models.Status] =
    stream.updateStatus(color) map { s =>
      StreamSupervisor.updateStatus(s, s.status)
      s.status
    }

  private def addChild(parent: models.Stream.OwnedStream, heirarchical: Boolean, child: models.Stream): Option[models.Stream] =
    if (parent.stream.childCount < models.Stream.maxChildren)
      parent.addChild(heirarchical, child) map { newChildData =>
        StreamSupervisor.addChild(parent.stream, child)
        child
      }
    else
      None

  private def createDescendant(parent: models.Stream.OwnedStream, name: models.StreamName): Option[models.Stream] =
    parent.createDescendant(name) flatMap { newChild =>
      addChild(parent, true, newChild)
    }

  private def removeChild(parent: models.Stream.OwnedStream, child: models.Stream): Option[models.Stream] = {
    parent.removeChild(child.id)
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
  private def doSetTags(stream: models.Stream.OwnedStream, tags: Seq[models.StreamTag]): Option[models.Stream] = {
    StreamSupervisor.updateTags(stream.stream, tags)
    stream.setTags(tags)
  }
}