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
abstract class CollectionActorBase(val path: Address) extends Actor
{
  private var state = Map[models.StreamUri, models.Status]()

  private var updated = mutable.ListBuffer[models.StreamUri]()

  def receive = {
    case GetCollectionStatus(size, offset) =>
      sender ! CollectionStatusResponse(updated.drop(offset).take(size).toList)

    case _ =>
  }

  protected def hasChild(childUri: models.StreamUri) =
    updated.contains(childUri)

  protected def updateChild(uri: models.StreamUri, status: models.Status): Unit =
    if (hasChild(uri)) {
      updated -= uri
      uri +=: updated
      state += (uri -> status)
      CollectionSupervisor.broadcast(path, StatusUpdatedEvent(uri, status, Some(path.value)))
    }

  protected def addChild(child: models.Stream): Unit = {
    if (!hasChild(child.getUri)) {
      child.getUri +=: updated
      state += (child.getUri -> child.status)
      CollectionSupervisor.broadcast(path, ChildAddedEvent(path, child, Some(path.value)))
      StreamSupervisor.subscribe(self, child.getUri())
    }
  }

  protected def removeChild(childUri: models.StreamUri): Unit = {
    if (hasChild(childUri)) {
      updated -= childUri
      state -= childUri
      StreamSupervisor.unsubscribe(self, childUri)
      CollectionSupervisor.broadcast(path, ChildRemovedEvent(path, childUri, Some(path.value)))
    }
  }

  protected def loadInitialChildren(): Seq[models.Stream]

  protected def loadChildren(): Seq[models.Stream] = {
    val children = loadInitialChildren()
    state = children.map(child => (child.getUri(), child.status)).toMap
    updated = updated ++ children.sortBy(-_.updated.getTime).map(_.getUri())
    children
  }
}

/**
 * Collection for a stream's children.
 */
class StreamCollection(streamUri: models.StreamUri) extends CollectionActorBase(Address.create(streamUri))
{
  override def receive = {
    case StatusUpdatedEvent(source, status, _) =>
      if (source.value != path.value) { // Skip root stream updates
        updateChild(source, status)
      }

    case ChildRemovedEvent(source, childUri, _) =>
      if (source.value == path.value) { // Only monitor root stream child changes
        removeChild(childUri)
      }

    case StreamDeletedEvent(source, _) =>
      removeChild(source)

    case ChildAddedEvent(source, child, _) =>
      if (source.value == path.value) {
        addChild(child)
      }

    case msg => super.receive(msg)
  }

  protected override def loadInitialChildren() =
    models.Stream.findByUri(streamUri) map { stream =>
      stream.getChildren()
    } getOrElse(List())

  override def preStart(): Unit = {
    val children = loadChildren()
    StreamSupervisor.subscribe(self, streamUri)
    StreamSupervisor.subscribe(self, children.map(_.getUri()))
  }
}

object StreamCollection
{
  def props(uri: models.StreamUri): Props = Props(new StreamCollection(uri))
}

/**
 * Collection for a tag.
 */
class TagCollection(tag: models.StreamTag) extends CollectionActorBase(Address.create(tag))
{
  override def receive = {
    case StatusUpdatedEvent(source, status, _) =>
      updateChild(source, status)
      
    case ChildRemovedEvent(source, childUri, _) =>
      removeChild(childUri)

    case StreamDeletedEvent(source, _) =>
      removeChild(source)

    case ChildAddedEvent(source, child, _) =>
        addChild(child)

    case msg => super.receive(msg)
  }

  protected override def loadInitialChildren() =
    models.Stream.getStreamWithTag(tag, 20)

  override def preStart(): Unit = {
    val children = loadChildren()
    StreamSupervisor.subscribe(self, children.map(_.getUri()))
  }

}

object TagCollection
{
  def props(name: models.StreamTag): Props = Props(new TagCollection(name))
}