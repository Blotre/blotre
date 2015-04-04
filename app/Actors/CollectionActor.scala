package Actors

import akka.actor._
import java.util.Date
import scala.collection.immutable.ListSet


case class GetCollectionStatus(name: String, offset: Int, size: Int)

case class GetCollectionStatusResponse(name: String, values: List[String])

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

  private var updated = ListSet[String]()

  def receive = {
    case msg@StatusUpdate(uri, status) =>
      updated -= uri
      updated += uri
      state += (uri -> status)

    case msg@AddChildEvent(uri, status) =>

    case GetCollectionStatus(_, offset, size) =>
      val results = updated.map { uri => state get uri}

    case _ =>
  }

  override def preStart(): Unit = {
    val children = models.Stream.findByUri(path) map { stream =>
      stream.getChildren()
    } getOrElse(List())

    state = children.map({ child => (child.uri, child.status) }).toMap
    updated = updated ++ children.sortBy(child => child.updated).map(_.uri)

    StreamSupervisor.subscribe(self, children.map(_.uri))
  }

}


object CollectionActor
{
  def props(name: String): Props = Props(new CollectionActor(name))
}