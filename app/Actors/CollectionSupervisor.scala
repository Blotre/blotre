package Actors

import akka.actor._
import akka.contrib.pattern.{DistributedPubSubExtension, DistributedPubSubMediator}
import akka.pattern.{ask}
import akka.util.Timeout
import play.api.Play.current
import play.api.libs.concurrent.Akka
import scala.concurrent.duration._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

case class GetCollection(topic: CollectionTopic)
case class GetCollectionResponse(actor: ActorRef)

case class SubscribeCollection(topic: CollectionTopic, ref: ActorRef)
case class UnsubscribeCollection(topic: CollectionTopic, ref: ActorRef)
case class PublishCollection(topic: CollectionTopic, msg:  Any)

/**
 * Manages all collections in the system.
 *
 * Attempts to kill collections that are no longer referenced.
 */
class CollectionSupervisor extends Actor
{
  private lazy val mediator = DistributedPubSubExtension.get(Akka.system).mediator

  private var subscriptions: Map[CollectionTopic, Set[ActorRef]] = Map()

  /**
   * Topic used to register a collection.
   */
  def receive = {
    case SubscribeCollection(topic, subscriber) =>
      onSubscribe(topic, subscriber)
      mediator ! DistributedPubSubMediator.Subscribe(topic.value, subscriber)

    case UnsubscribeCollection(topic, subscriber) =>
      onUnsubscribe(topic, subscriber)
      mediator ! DistributedPubSubMediator.Unsubscribe(topic.value, subscriber)

    case PublishCollection(topic, msg) =>
      mediator ! DistributedPubSubMediator.Publish(topic.value, msg)

    case GetCollection(topic) =>
      sender ! GetCollectionResponse(getOrCreateChild(topic))
  }

  /**
   * Get an existing child if one exists.
   */
  private def getExistingChild(topic: CollectionTopic) =
    context.child(topic.actorName)

  /**
   * Create a new child.
   */
  private def createChild(topic: CollectionTopic) =
    topic match {
      case StreamCollectionTopic(uri) =>
        context.actorOf(StreamCollection.props(uri), name = topic.actorName)

      case TagCollectionTopic(uri) =>
        context.actorOf(TagCollection.props(uri), name = topic.actorName)
    }

  /**
   * Get an existing child or create a new one.
   */
  private def getOrCreateChild(topic: CollectionTopic) =
    getExistingChild(topic).getOrElse(createChild(topic))

  /**
   * Invoked when a subscriber has been successfully registered.
   */
  private def onSubscribe(path: CollectionTopic, subscriber: ActorRef): Unit = {
    getOrCreateChild(path) // ensure child exists
    subscriptions += ((path, subscriptions.getOrElse(path, Set()) + subscriber))
  }

  /**
   * Invoked when a subscriber has been successfully unregistered.
   *
   * If the subscriber count reaches zero, kicks off a job to potentially kill the
   * child collection actor if no other subscriptions are added.
   */
  private def onUnsubscribe(path: CollectionTopic, subscriber: ActorRef): Unit = {
    val collectionSubscribers = subscriptions.getOrElse(path, Set()) - subscriber
    subscriptions += ((path, collectionSubscribers))

    if (collectionSubscribers.size == 0) {
      subscriptions -= path
      tryRemoveChild(path)
    }
  }

  private def tryRemoveChild(path: CollectionTopic) =
    context.system.scheduler.scheduleOnce(5 seconds) {
      subscriptions.get(path) map { subscribers =>
        if (subscribers.size == 0) {
          removeChild(path)
        }
      } orElse {
        removeChild(path)
      }
    }

  private def removeChild(path: CollectionTopic) = {
    getExistingChild(path) map {
      _ ! PoisonPill
    }
  }
}

object CollectionSupervisor
{
  def props(): Props = Props(new CollectionSupervisor())

  lazy val supervisor = Akka.system.actorOf(props())

  implicit val timeout = Timeout(5 seconds)

  /**
   * Get the actor for a collection.
   */
  private def getCollection(topic: CollectionTopic): Future[ActorRef] =
    ask(supervisor, GetCollection(topic)).mapTo[GetCollectionResponse].map(_.actor)

  private def getCollectionState(topic: CollectionTopic, limit: Int, offset: Int): Future[Seq[models.StreamUri]] =
    getCollection(topic) flatMap { collection =>
      ask(collection, GetCollectionStatus(limit, offset)).mapTo[CollectionStatusResponse]
    } map {
      _.children
    }

  /**
   * Get the in-memory state of a stream collection.
   */
  def getStreamCollection(uri: models.StreamUri, limit: Int, offset: Int): Future[Seq[models.StreamUri]] =
    getCollectionState(CollectionTopic.forStream(uri), limit, offset)

  /**
   * Get the in-memory state of a tag collection.
   */
  def getTagCollection(tag: models.StreamTag, limit: Int, offset: Int): Future[Seq[models.StreamUri]] =
    getCollectionState(CollectionTopic.forTag(tag), limit, offset)

  /**
   * Subscribe an actor to a collection's events.
   */
  def subscribeCollection(subscriber: ActorRef, path: Address): Unit =
    supervisor ! SubscribeCollection(CollectionTopic.fromAddress(path), subscriber)

  /**
   * Unsubscribe an actor from a collection's events.
   */
  def unsubscribeCollection(subscriber: ActorRef, path: Address): Unit =
    supervisor ! UnsubscribeCollection(CollectionTopic.fromAddress(path), subscriber)

  /**
   * Broadcast an event for a collection.
   */
  def broadcast[A](publisher: Address, event: A): Unit =
    supervisor ! PublishCollection(CollectionTopic.fromAddress(publisher), event)
}