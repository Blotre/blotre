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
 */
object StreamSupervisor
{
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  private def getStreamTopic(path: String): Option[String] = {
    val normalizePath = ActorHelper.normalizeName(path)
    if (normalizePath.isEmpty) None else Some(normalizePath)
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
      mediator ! DistributedPubSubMediator.Publish(topic, StatusUpdate(path, status))
  }

  def addChild(path: String, child: models.Stream) =
    getStreamTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, ChildAddedEvent(path, child))
  }
}