package Actors

import akka.actor._
import akka.contrib.pattern.DistributedPubSubExtension
import akka.contrib.pattern.DistributedPubSubMediator
import helper._
import play.api.Play.current
import play.api.libs.concurrent.Akka
import play.api.libs.concurrent.Execution.Implicits._
import play.api.libs.json.{Json, JsValue, Writes}
import play.api.libs.functional.syntax._

/**
 * Manages the main stream status change event bus.
 */
object StreamSupervisor {
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  def subscribe(subscriber: ActorRef, path: String): Unit = {
    val topic = ActorHelper.normalizeName(path)
    if (!topic.isEmpty)
      mediator ! DistributedPubSubMediator.Subscribe(topic, subscriber)
  }

  def subscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => subscribe(subscriber, x) }

  def unsubscribe(subscriber: ActorRef, path: String): Unit = {
    val topic = ActorHelper.normalizeName(path)
    if (!topic.isEmpty)
      mediator ! DistributedPubSubMediator.Unsubscribe(topic, subscriber)
  }

  def unsubscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => unsubscribe(subscriber, x) }

  def updateStatus(path: String, status: models.Status) = {
    val topic = ActorHelper.normalizeName(path)
    if (!topic.isEmpty)
      mediator ! DistributedPubSubMediator.Publish(topic, StatusUpdate(path, status))
  }
}