package Actors

import akka.actor._
import java.util.Date
import scala.collection.mutable.ListBuffer

case class GetCollectionStatus(size: Int, offset: Int)

case class GetCollectionStatusResponse(values: Seq[String])

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

  private var updated = ListBuffer[String]()

  private def updateChild(uri: String, status: models.Status): Unit = {
    updated -= uri
    uri +=: updated
    state += (uri -> status)
    CollectionSupervisor.broadcast(path, StatusUpdate(uri, status, Some(path)))
  }

  private def addChild(child: models.Stream): Unit = {
    child.uri +=: updated
    state += (child.uri -> child.status)
    CollectionSupervisor.broadcast(path, ChildAddedEvent(path, child, Some(path)))
    StreamSupervisor.subscribe(self, child.uri)
  }

  private def removeChild(child: models.Stream): Unit = {
    updated -= child.uri
    state -= child.uri
    StreamSupervisor.unsubscribe(self, child.uri)
    CollectionSupervisor.broadcast(path, ChildRemovedEvent(path, child, Some(path)))
  }

  def receive = {
    case msg@StatusUpdate(uri, status, _) =>
      if (uri != path) { // Skip root stream updates
        updateChild(uri, status)
      }

    case msg@ChildRemovedEvent(uri, child, _) =>
      if (uri == path) { // Only monitor root stream child changes
        removeChild(child)
      }

    case msg@ChildAddedEvent(uri, child, _) =>
      if (uri == path && !state.contains(child.uri)) { // Only monitor root stream child changes
        addChild(child)
      }

    case GetCollectionStatus(size, offset) =>
      sender ! updated.drop(offset).take(size)

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