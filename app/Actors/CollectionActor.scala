package actors

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
class CollectionActor(path: String) extends Actor
{
  case class Updated(name: String, updated: Date)

  private var state = Map[String, models.Status]()

  private var updated = mutable.ListBuffer[String]()

  private def hasChild(childUri: String) =
    updated.contains(childUri)

  private def updateChild(uri: String, status: models.Status): Unit =
    if (hasChild(uri)) {
      updated -= uri
      uri +=: updated
      state += (uri -> status)
      CollectionSupervisor.broadcast(path, StatusUpdatedEvent(uri, status, Some(path)))
    }

  private def addChild(child: models.Stream): Unit =
    if (!hasChild(child.uri)) {
      child.uri +=: updated
      state += (child.uri -> child.status)
      CollectionSupervisor.broadcast(path, ChildAddedEvent(path, child, Some(path)))
      StreamSupervisor.subscribe(self, child.uri)
    }

  private def removeChild(childUri: String): Unit =
    if (hasChild(childUri)) {
      updated -= childUri
      state -= childUri
      StreamSupervisor.unsubscribe(self, childUri)
      CollectionSupervisor.broadcast(path, ChildRemovedEvent(path, childUri, Some(path)))
    }

  def receive = {
    case StatusUpdatedEvent(uri, status, _) =>
      if (uri != path) { // Skip root stream updates
        updateChild(uri, status)
      }

    case ChildRemovedEvent(uri, childUri, _) =>
      if (uri == path) { // Only monitor root stream child changes
        removeChild(childUri)
      }

    case StreamDeletedEvent(uri, _) =>
      removeChild(uri)

    case ChildAddedEvent(uri, child, _) =>
      if (uri == path && !state.contains(child.uri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! updated.drop(offset).take(size).toList

    case _ =>
  }

  override def preStart(): Unit = {
    val children = models.Stream.findByUri(path) map { stream =>
      stream.getChildren()
    } getOrElse(List())

    state = children.map(child => (child.uri, child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.uri)

    StreamSupervisor.subscribe(self, path)
    StreamSupervisor.subscribe(self, children.map(_.uri))
  }
}


object CollectionActor
{
  def props(name: String): Props = Props(new CollectionActor(name))
}