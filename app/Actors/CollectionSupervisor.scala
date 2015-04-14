package Actors

import akka.actor._
import akka.contrib.pattern.DistributedPubSubExtension
import akka.contrib.pattern.DistributedPubSubMediator
import akka.pattern.{ask}
import akka.util.Timeout
import helper._
import play.api.Play.current
import play.api.libs.concurrent.Akka
import scala.concurrent.duration._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

case class GetCollection(uri: String)
case class GetCollectionResponse(actor: ActorRef)

/**
 * Manages collection actors.
 *
 * Each collection in the system is represented by an actor.
 */
class CollectionSupervisor extends Actor
{
  def receive = {
    case GetCollection(uri) =>
      sender ! GetCollectionResponse(getOrCreateChild(uri))
  }

  private def getOrCreateChild(uri: String) = {
    val name = ActorHelper.normalizeName(uri)
    context.child(name) getOrElse (context.actorOf(CollectionActor.props(uri), name = name))
  }
}

object CollectionSupervisor
{
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  def props(): Props = Props(new CollectionSupervisor())

  lazy val supervisor = Akka.system.actorOf(props())

  implicit val timeout = Timeout(5 seconds)

  def getTopic(path: String): Option[String] = {
    val normalizePath = ActorHelper.normalizeName(path)
    if (normalizePath.isEmpty) None else Some("@collection/" + normalizePath)
  }

  /**
   * Get the actor for a collection.
   */
  def getCollection(uri: String): Future[ActorRef] =
    models.Stream.findByUri(uri).map(getCollection(_)).getOrElse(Future.successful(null))

  def getCollection(stream: models.Stream): Future[ActorRef] =
    ask(supervisor, GetCollection(stream.uri)).mapTo[GetCollectionResponse].map(_.actor)

  /**
   *
   */
  def getCollectionState(uri: String, count: Int, offset: Int): Future[Seq[String]] =
    getCollection(uri) flatMap { collection =>
      ask(collection, GetCollectionStatus(count, offset)).mapTo[Seq[String]]
    }

  private def getStreamTopic(path: String): Option[String] = {
    val normalizePath = ActorHelper.normalizeName(path)
    if (normalizePath.isEmpty) None else Some(normalizePath)
  }

  def subscribeCollection(subscriber: ActorRef, path: String): Unit =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Subscribe(topic, subscriber)
    }

  def unsubscribeCollection(subscriber: ActorRef, path: String): Unit =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Unsubscribe(topic, subscriber)
    }

  def broadcast[A](path: String, event: A) =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, event)
    }
}