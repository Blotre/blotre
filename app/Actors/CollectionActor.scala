package Actors

import akka.actor._
import java.util.Date
import scala.collection.{mutable}

case class GetCollectionStatus(size: Int, offset: Int)

/**
 * Manages a collection.
 *
 * Takes a snapshot of the stream's children on creation and subscribes to events on these children.
 * Creates and maintains an in-memory representation of the children's state.
 */
abstract class CollectionActorBase(path: String) extends Actor
{
  case class Updated(name: String, updated: Date)

  protected var state = Map[String, models.Status]()

  protected var updated = mutable.ListBuffer[String]()

  protected def hasChild(childUri: String) =
    updated.contains(childUri)

  protected def updateChild(uri: String, status: models.Status): Unit =
    if (hasChild(uri)) {
      updated -= uri
      uri +=: updated
      state += (uri -> status)
      CollectionSupervisor.broadcast(path, StatusUpdatedEvent(uri, status, Some(path)))
    }

  protected def addChild(child: models.Stream): Unit =
    if (!hasChild(child.uri)) {
      child.uri +=: updated
      state += (child.uri -> child.status)
      CollectionSupervisor.broadcast(path, ChildAddedEvent(path, child, Some(path)))
      StreamSupervisor.subscribe(self, child.uri)
    }

  protected def removeChild(childUri: String): Unit =
    if (hasChild(childUri)) {
      updated -= childUri
      state -= childUri
      StreamSupervisor.unsubscribe(self, childUri)
      CollectionSupervisor.broadcast(path, ChildRemovedEvent(path, childUri, Some(path)))
    }
}

/**
 *
 */
class CollectionActor(streamUri: models.StreamUri)  extends CollectionActorBase(streamUri.value)
{
  def receive = {
    case StatusUpdatedEvent(uri, status, _) =>
      if (uri != streamUri) { // Skip root stream updates
        updateChild(uri, status)
      }

    case ChildRemovedEvent(uri, childUri, _) =>
      if (uri == streamUri) { // Only monitor root stream child changes
        removeChild(childUri)
      }

    case StreamDeletedEvent(uri, _) =>
      removeChild(uri)

    case ChildAddedEvent(uri, child, _) =>
      if (uri == streamUri && !state.contains(child.uri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! updated.drop(offset).take(size).toList

    case _ =>
  }

  protected def loadInitialChildren() =
    models.Stream.findByUri(streamUri) map { stream =>
      stream.getChildren()
    } getOrElse(List())

  override def preStart(): Unit = {
    val children = loadInitialChildren()
    state = children.map(child => (child.uri, child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.uri)

    StreamSupervisor.subscribe(self, streamUri.value)
    StreamSupervisor.subscribe(self, children.map(_.uri))
  }
}

object CollectionActor
{
  def props(name: models.StreamUri): Props = Props(new CollectionActor(name))
}

/**
 *
 */
class TagCollectionActor(tag: models.StreamTag)  extends CollectionActorBase(tag.value)
{
  protected def loadInitialChildren() =
    models.Stream.getStreamWithTag(tag, 20)

  override def preStart(): Unit = {
    val children = loadInitialChildren()
    state = children.map(child => (child.uri, child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.uri)

    StreamSupervisor.subscribe(self, children.map(_.uri))
  }

  def receive = {
    case StatusUpdatedEvent(uri, status, _) =>
      updateChild(uri, status)

    case ChildRemovedEvent(uri, childUri, _) =>
        removeChild(childUri)


    case StreamDeletedEvent(uri, _) =>
      removeChild(uri)

    case ChildAddedEvent(uri, child, _) =>
      if (!state.contains(child.uri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! updated.drop(offset).take(size).toList

    case _ =>
  }
}

object TagCollectionActor
{
  def props(name: models.StreamTag): Props = Props(new TagCollectionActor(name))
}