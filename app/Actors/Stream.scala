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
   * Get the Akka path of a stream.
   */
  private def getStreamTopic(path: models.StreamUri): Option[String] =
    Some(ActorHelper.normalizeName(path.value))
      .filterNot(_.isEmpty)
      .map("streams/" + _)

  private def getStreamTopic(path: String): Option[String] =
    models.StreamUri.fromString(path).flatMap(getStreamTopic)

  /**
   * Get the Akka path of a collection.
   */
  private def getCollectionTopic(tag: models.StreamTag): Option[String] =
    Some(ActorHelper.normalizeName(tag.value))
      .filterNot(_.isEmpty)
      .map("collections/" + _)

  /**
   * Get the Akka path of any stream like object.
   */
  private def getTopic(path: String): Option[String] =
    if (path.length > 1 && path.startsWith("#"))
      getCollectionTopic(models.StreamTag(path.substring(1)))
    else
      getStreamTopic(path)

  /**
   * Subscribe an actor to updates from a given stream.
   */
  def subscribe(subscriber: ActorRef, path: String): Unit =
    getTopic(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Subscribe(topic, subscriber)
    }

  def subscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths foreach {
      x => subscribe(subscriber, x)
    }

  /**
   * Unsubscribe an actor to updates from a given stream.
   */
  def unsubscribe(subscriber: ActorRef, path: String): Unit =
    getTopic(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Unsubscribe(topic, subscriber)
    }

  def unsubscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths foreach { x =>
      unsubscribe(subscriber, x)
    }

  /**
   * Broadcast stream status updated.
   */
  def updateStatus(stream: models.Stream, status: models.Status): Unit = {
    getStreamTopic(stream.uri) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, StatusUpdatedEvent(stream.uri, status))
    }

    stream.getTags().flatMap(getCollectionTopic(_)) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, StatusUpdatedEvent(stream.uri, status))
    }
  }

  /**
   * Broadcast stream child added.
   */
  def addChild(parent: models.Stream, child: models.Stream): Unit = {
    getStreamTopic(parent.uri) foreach { parentTopic =>
      mediator ! DistributedPubSubMediator.Publish(parentTopic, ChildAddedEvent(parent.uri, child))
    }
    getStreamTopic(child.uri) foreach { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic, ParentAddedEvent(child.uri, parent))
    }
  }

  /**
   * Broadcast stream child removed.
   */
  def removeChild(path: String, childUri: String): Unit = {
    getStreamTopic(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, ChildRemovedEvent(path, childUri))
    }
    getStreamTopic(childUri) foreach { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic, ParentRemovedEvent(childUri, path))
    }
  }

  /**
   * Broadcast stream deleted.
   */
  def deleteStream(path: String): Unit =
    getStreamTopic(path) foreach { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, StreamDeletedEvent(path))
    }

  /**
   * Broadcast stream tags changed.
   */
  def updateTags(stream: models.Stream, tags: Seq[models.StreamTag]): Unit = {
    val addedTags = stream.getTags() diff tags
    val removedTags = tags diff stream.getTags()

    addedTags foreach { addedTag =>
      getCollectionTopic(addedTag) foreach { collectionTopic =>
        mediator ! DistributedPubSubMediator.Publish(collectionTopic, ChildAddedEvent(addedTag.value, stream))
      }
    }

    removedTags foreach { removedTag =>
      getCollectionTopic(removedTag) foreach { collectionTopic =>
        mediator ! DistributedPubSubMediator.Publish(collectionTopic, ChildAddedEvent(removedTag.value, stream))
      }
    }
  }
}