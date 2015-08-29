package Actors

import akka.actor._
import akka.contrib.pattern.DistributedPubSubExtension
import akka.contrib.pattern.DistributedPubSubMediator
import helper._
import play.api.Play.current
import play.api.libs.concurrent.Akka
import play.api.libs.concurrent.Execution.Implicits._

/**
 * Manages the main stream status change event bus.
 *
 * TODO: break out subscription types.
 */
object StreamSupervisor
{
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  /**
   * Broadcast an event.
   */
  private def broadcast[A](topic: StreamTopic, event: A): Unit =
    mediator ! DistributedPubSubMediator.Publish(topic.value, event)

  /**
   * Subscribe to updates from a given stream.
   */
  def subscribe(subscriber: ActorRef, topic: StreamTopic): Unit =
    mediator ! DistributedPubSubMediator.Subscribe(topic.value, subscriber)

  /**
   * Subscribe to updates from a stream.
   */
  def subscribe(subscriber: ActorRef, path: models.StreamUri): Unit =
    StreamTopic.forStream(path).foreach(subscribe(subscriber, _))

  def subscribe(subscriber: ActorRef, paths: Iterable[models.StreamUri]): Unit =
    paths.foreach(subscribe(subscriber, _))

  /**
   * Unsubscribe from updates on a given stream.
   */
  def unsubscribe(subscriber: ActorRef, path: models.StreamUri): Unit =
    StreamTopic.forStream(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Unsubscribe(topic.value, subscriber)
    }

  def unsubscribe(subscriber: ActorRef, paths: Iterable[models.StreamUri]): Unit =
    paths.foreach(unsubscribe(subscriber, _))

  /**
   * Broadcast stream status updated.
   */
  def updateStatus(stream: models.Stream, status: models.Status): Unit = {
    StreamTopic.forStream(stream) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic.value, StatusUpdatedEvent(stream.getUri().value, status))
    }

    stream.getTags().flatMap(StreamTopic.forTag(_)) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic.value, StatusUpdatedEvent(stream.getUri().value, status))
    }
  }

  /**
   * Broadcast stream child added.
   */
  def addChild(parent: models.Stream, child: models.Stream): Unit = {
    StreamTopic.forStream(parent) foreach { parentTopic =>
      mediator ! DistributedPubSubMediator.Publish(parentTopic.value, ChildAddedEvent(parent.getUri().value, child))
    }
    StreamTopic.forStream(child) foreach { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic.value, ParentAddedEvent(child.getUri().value, parent))
    }
  }

  /**
   * Broadcast stream child removed.
   */
  def removeChild(path: models.StreamUri, childUri: models.StreamUri): Unit = {
    StreamTopic.forStream(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic.value, ChildRemovedEvent(path.value, childUri.value))
    }
    StreamTopic.forStream(childUri) foreach { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic.value, ParentRemovedEvent(childUri.value, path.value))
    }
  }

  /**
   * Broadcast stream deleted.
   */
  def deleteStream(path: models.StreamUri): Unit =
    StreamTopic.forStream(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic.value, StreamDeletedEvent(path.value))
    }

  /**
   * Broadcast stream tags changed.
   */
  def updateTags(stream: models.Stream, tags: Seq[models.StreamTag]): Unit = {
    addedTags(stream, stream.getTags() diff tags)
    removedTags(stream, tags diff stream.getTags())
  }

  /**
   * Broadcast stream tags added.
   */
  def addedTags(stream: models.Stream, addedTags: Seq[models.StreamTag]): Unit =
    addedTags foreach { tag =>
      StreamTopic.forTag(tag) foreach {
        broadcast(_, ChildAddedEvent(tag.value, stream))
      }
    }

  /**
   * Broadcast stream tags removed.
   */
  def removedTags(stream: models.Stream, removedTags: Seq[models.StreamTag]): Unit =
    removedTags foreach { tag =>
      StreamTopic.forTag(tag) foreach {
        broadcast(_, ChildRemovedEvent(tag.value, stream.getUri().value))
      }
    }
}