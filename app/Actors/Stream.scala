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

  private def getStreamTopic(path: String): Option[String] = {
    val normalizePath = ActorHelper.normalizeName(models.Stream.normalizeUri(path).value)
    if (normalizePath.isEmpty)
      None
    else
      Some(normalizePath)
  }

  def subscribe(subscriber: ActorRef, path: String): Unit =
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Subscribe(topic, subscriber)
    }

  def subscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => subscribe(subscriber, x) }

  def unsubscribe(subscriber: ActorRef, path: String): Unit =
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Unsubscribe(topic, subscriber)
  }

  def unsubscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => unsubscribe(subscriber, x) }

  def updateStatus(path: String, status: models.Status) =
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, StatusUpdatedEvent(path, status))
    }

  def addChild(parent: models.Stream, child: models.Stream) = {
    getStreamTopic(parent.uri) map { parentTopic =>
      mediator ! DistributedPubSubMediator.Publish(parentTopic, ChildAddedEvent(parent.uri, child))
    }
    getStreamTopic(child.uri) map { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic, ParentAddedEvent(child.uri, parent))
    }
  }

  def removeChild(path: String, childUri: String) = {
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, ChildRemovedEvent(path, childUri))
    }
    getStreamTopic(childUri) map { childTopic =>
      mediator ! DistributedPubSubMediator.Publish(childTopic, ParentRemovedEvent(childUri, path))
    }
  }

  def deleteStream(path: String) =
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, StreamDeletedEvent(path))
    }
}