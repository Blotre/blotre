package Actors

import akka.actor._
import akka.contrib.pattern.{DistributedPubSubExtension, DistributedPubSubMediator}
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
 * Subscription to a collection.
 */
class CollectionSubscription(supervisor: ActorRef, out: ActorRef) extends Actor
{
  import akka.contrib.pattern.DistributedPubSubMediator._

  def receive = {
    case x: SubscribeAck => supervisor forward x
    case x => out forward x
  }
}

object CollectionSubscription
{
  def props(supervisor: ActorRef, out: ActorRef): Props = Props(new CollectionSubscription(supervisor, out))
}


/**
 * Manages collection actors.
 *
 * Each collection in the system is represented by an actor.
 */
class CollectionSupervisor extends Actor
{
  import akka.contrib.pattern.DistributedPubSubMediator._

  var subscriptions: Map[String, Set[ActorRef]] = Map()

  def receive = {
    case SubscribeAck(Subscribe(path, _, subscriber)) =>
      onSubscribe(path, subscriber)

    case UnsubscribeAck(Unsubscribe(path, _, subscriber)) =>
      onUnsubscribe(path, subscriber)

    case GetCollection(uri) =>
      sender ! GetCollectionResponse(getOrCreateChild(uri))
  }

  private def getOrCreateChild(uri: String) = {
    val name = ActorHelper.normalizeName(uri)
    context.child(name) getOrElse (context.actorOf(CollectionActor.props(uri), name = name))
  }

  /**
   * Invoked when a subscriber has been successfully registered.
   */
  private def onSubscribe(path: String, subscriber: ActorRef): Unit =
    subscriptions += ((path, subscriptions.getOrElse(path, Set()) + subscriber))

  /**
   * Invoked when a subscriber has been successfully unregistered.
   *
   * If the subscriber count reaches zero, kicks off a job to potentially kill the
   * child collection actor if no other subscriptions are added.
   */
  private def onUnsubscribe(path: String, subscriber: ActorRef): Unit = {
    val collectionSubscribers = subscriptions.getOrElse(path, Set()) - subscriber
    subscriptions += ((path, collectionSubscribers))

    if (collectionSubscribers.size == 0) {
      tryRemoveChild(path)
    }
  }

  private def tryRemoveChild(path:String) =
    context.system.scheduler.scheduleOnce(5 seconds) {
      subscriptions.get(path) map { subscribers =>
        if (subscribers.size == 0) {
          context.child(path) map { _ ! PoisonPill }
        }
      }
    }
}

object CollectionSupervisor
{
  lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  def props(): Props = Props(new CollectionSupervisor())

  lazy val supervisor = Akka.system.actorOf(props())

  implicit val timeout = Timeout(5 seconds)

  private def getTopic(path: String): Option[String] = {
    val normalizePath = ActorHelper.normalizeName(path)
    if (normalizePath.isEmpty) None else Some("@collection/" + normalizePath)
  }

  /**
   * Get the actor for a collection.
   */
  private def getCollection(uri: String): Future[ActorRef] =
    models.Stream.findByUri(uri).map(getCollection(_)).getOrElse(Future.successful(null))

  private def getCollection(stream: models.Stream): Future[ActorRef] =
    ask(supervisor, GetCollection(stream.uri)).mapTo[GetCollectionResponse].map(_.actor)

  /**
   * Get the in-memory state of a collection.
   */
  def getCollectionState(uri: String, limit: Int, offset: Int): Future[List[String]] =
    getCollection(uri) flatMap { collection =>
      ask(collection, GetCollectionStatus(limit, offset)).mapTo[List[String]]
    }

  /**
   * Subscribe an actor to a collection's events.
   */
  def subscribeCollection(subscriber: ActorRef, path: String): Unit =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Subscribe(
        topic,
        Akka.system.actorOf(Props(new CollectionSubscription(supervisor, subscriber))))
    }

  /**
   * Unsubscribe an actor from a collection's events.
   */
  def unsubscribeCollection(subscriber: ActorRef, path: String): Unit =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Unsubscribe(topic, supervisor)
    }

  /**
   * Send a message to for a collection.
   */
  def broadcast[A](path: String, event: A): Unit =
    getTopic(path) map { topic =>
      mediator ! DistributedPubSubMediator.Publish(topic, event)
    }
}