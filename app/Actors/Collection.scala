package Actors

import akka.actor._
import java.util.Date
import scala.collection.{mutable}

case class GetCollectionStatus(size: Int, offset: Int)
case class CollectionStatusResponse(children: Seq[models.StreamUri])

/**
 * Manages a collection.
 *
 * Takes a snapshot of the stream's children on creation and subscribes to events on these children.
 * Creates and maintains an in-memory representation of the children's state.
 */
abstract class CollectionActorBase(path: models.StreamUri) extends Actor
{
  case class Updated(name: models.StreamUri, updated: Date)

  protected var state = Map[models.StreamUri, models.Status]()

  protected var updated = mutable.ListBuffer[models.StreamUri]()

  protected def hasChild(childUri:  models.StreamUri) =
    updated.contains(childUri)

  protected def updateChild(uri: models.StreamUri, status: models.Status): Unit =
    if (hasChild(uri)) {
      updated -= uri
      uri +=: updated
      state += (uri -> status)
      CollectionSupervisor.broadcast(path, StatusUpdatedEvent(uri.value, status, Some(path.value)))
    }

  protected def addChild(child: models.Stream): Unit =
    if (!hasChild(child.getUri())) {
      child.getUri +=: updated
      state += (child.getUri -> child.status)
      CollectionSupervisor.broadcast(path, ChildAddedEvent(Address.forStream(path), child, Some(path.value)))
      StreamSupervisor.subscribe(self, child.getUri())
    }

  protected def removeChild(childUri: models.StreamUri): Unit =
    if (hasChild(childUri)) {
      updated -= childUri
      state -= childUri
      StreamSupervisor.unsubscribe(self, childUri)
      CollectionSupervisor.broadcast(path, ChildRemovedEvent(Address.forStream(path), childUri.value, Some(path.value)))
    }
}

/**
 *
 */
class StreamCollection(streamUri: models.StreamUri) extends CollectionActorBase(streamUri)
{
  def receive = {
    case StatusUpdatedEvent(uri, status, _) =>
      if (uri != streamUri.value) { // Skip root stream updates
        models.StreamUri.fromString(uri).foreach(updateChild(_, status))
      }

    case ChildRemovedEvent(uri, childUri, _) =>
      if (uri == streamUri.value) { // Only monitor root stream child changes
        models.StreamUri.fromString(childUri).foreach(removeChild(_))
      }

    case StreamDeletedEvent(uri, _) =>
      models.StreamUri.fromString(uri).foreach(removeChild(_))

    case ChildAddedEvent(uri, child, _) =>
      if (uri == streamUri.value && !state.contains(child.getUri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! CollectionStatusResponse(updated.drop(offset).take(size).toList)

    case _ =>
  }

  protected def loadInitialChildren() =
    models.Stream.findByUri(streamUri) map { stream =>
      stream.getChildren()
    } getOrElse(List())

  override def preStart(): Unit = {
    val children = loadInitialChildren()
    state = children.map(child => (child.getUri(), child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.getUri())

    StreamSupervisor.subscribe(self, streamUri)
    StreamSupervisor.subscribe(self, children.map(_.getUri()))
  }
}

object StreamCollection
{
  def props(name: models.StreamUri): Props = Props(new StreamCollection(name))
}

/**
 *
 */
class TagCollection(tag: models.StreamTag)  extends CollectionActorBase(models.StreamUri(tag.value))
{
  protected def loadInitialChildren() =
    models.Stream.getStreamWithTag(tag, 20)

  override def preStart(): Unit = {
    val children = loadInitialChildren()
    state = children.map(child => (child.getUri, child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.getUri())

    StreamSupervisor.subscribe(self, children.map(_.getUri()))
  }

  def receive = {
    case StatusUpdatedEvent(uri, status, _) =>
      models.StreamUri.fromString(uri).foreach(updateChild(_, status))

    case ChildRemovedEvent(uri, childUri, _) =>
      models.StreamUri.fromString(childUri).foreach(removeChild(_))


    case StreamDeletedEvent(uri, _) =>
      models.StreamUri.fromString(uri).foreach(removeChild(_))

    case ChildAddedEvent(uri, child, _) =>
      if (!state.contains(child.getUri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! CollectionStatusResponse(updated.drop(offset).take(size).toList)

    case _ =>
  }
}

object TagCollection
{
  def props(name: models.StreamTag): Props = Props(new TagCollection(name))
}