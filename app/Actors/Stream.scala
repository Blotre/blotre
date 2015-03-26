package Actors

import akka.actor._

import play.api.Play.current
import play.api.libs.concurrent.Akka
import play.api.libs.concurrent.Execution.Implicits._
import akka.contrib.pattern.DistributedPubSubExtension
import akka.contrib.pattern.DistributedPubSubMediator
import play.api.libs.json.{Json, JsValue, Writes}
import play.api.libs.functional.syntax._

/**
 *
 */
case class StatusUpdate(uri: String, status: models.Status)

object StatusUpdate {
  implicit val statusWrites = new Writes[StatusUpdate] {
    def writes(x: StatusUpdate): JsValue =
      Json.obj(
        "type" -> "StatusUpdate",
        "stream" -> Json.obj(
          "uri" -> x.uri,
          "updated" -> x.status.created,
          "status" -> x.status))
  }
}

/**
 *
 */
object StreamSupervisor {
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  def subscribe(subscriber: ActorRef, path: String): Unit =
    mediator ! DistributedPubSubMediator.Subscribe(path, subscriber)

  def subscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => subscribe(subscriber, x) }

  def unsubscribe(subscriber: ActorRef, path: String): Unit =
    mediator ! DistributedPubSubMediator.Unsubscribe(path, subscriber)

  def unsubscribe(subscriber: ActorRef, paths: Iterable[String]): Unit =
    paths.foreach { x => unsubscribe(subscriber, x) }

  def updateStatus(path: String, status: models.Status) =
     mediator ! DistributedPubSubMediator.Publish(path, StatusUpdate(path, status))
}