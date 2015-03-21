package Actors

import akka.actor._

import play.api.Play.current
import play.api.libs.concurrent.Akka
import play.api.libs.concurrent.Execution.Implicits._
import akka.contrib.pattern.DistributedPubSubExtension
import akka.contrib.pattern.DistributedPubSubMediator

/**
 *
 */
object StreamActor {
  case class StatusUpdate(uri: String, status: models.Status)
}

/**
 *
 */
object StreamSupervisor {
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  def subscribe(path: String, subscriber: ActorRef) =
    mediator ! DistributedPubSubMediator.Subscribe(path, subscriber)

  def unsubscribe(path: String, subscriber: ActorRef) =
    mediator ! DistributedPubSubMediator.Unsubscribe(path, subscriber)

   def updateStatus(path: String, status: models.Status) =
     mediator ! DistributedPubSubMediator.Publish(path, StreamActor.StatusUpdate(path, status))
}