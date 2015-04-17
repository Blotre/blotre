package Actors

import akka.actor._
import models.User
import play.api.libs.json._

/**
 * Current stream status response.
 */
case class CurrentStatusResponse(uri: String, status: models.Status)

object CurrentStatusResponse
{
  implicit val statusWrites = new Writes[CurrentStatusResponse] {
    def writes(x: CurrentStatusResponse): JsValue =
      Json.obj(
        "type" -> "StreamStatus",
        "from" -> x.uri,
        "status" -> x.status)
  }
}

/**
 * Stream status update event.
 */
case class StatusUpdatedEvent(uri: String, status: models.Status, source: Option[String] = None)

object StatusUpdatedEvent
{
  implicit val statusWrites = new Writes[StatusUpdatedEvent] {
    def writes(x: StatusUpdatedEvent): JsValue =
      Json.obj(
        "type" -> "StatusUpdated",
        "from" -> x.uri,
        "status" -> x.status,
        "source" -> x.source)
  }
}

/**
 * Stream deleted event
 */
case class StreamDeletedEvent(uri: String, source: Option[String] = None)

object StreamDeletedEvent extends
{
  implicit val addChildWrites = new Writes[StreamDeletedEvent] {
    def writes(x: StreamDeletedEvent): JsValue =
      Json.obj(
        "type" -> "StreamDeleted",
        "from" -> x.uri,
        "source" -> x.source)
  }
}

/**
 * Stream child added event.
 */
case class ChildAddedEvent(uri: String, child: models.Stream, source: Option[String] = None)

object ChildAddedEvent extends
{
  implicit val addChildWrites = new Writes[ChildAddedEvent] {
    def writes(x: ChildAddedEvent): JsValue =
      Json.obj(
        "type" -> "ChildAdded",
        "from" -> x.uri,
        "child" -> x.child,
        "source" -> x.source)
  }
}

/**
 * Stream child removed event.
 */
case class ChildRemovedEvent(uri: String, child: String, source: Option[String] = None)

object ChildRemovedEvent extends
{
  implicit val removeChildWrites = new Writes[ChildRemovedEvent] {
    def writes(x: ChildRemovedEvent): JsValue =
      Json.obj(
        "type" -> "ChildRemoved",
        "from" -> x.uri,
        "child" -> x.child,
        "source" -> x.source)
  }
}

/**
 *
 */
case class SocketError(error: String, correlation: Int)

object SocketError
{
  implicit val statusWrites = new Writes[SocketError] {
    def writes(x: SocketError): JsValue =
      Json.obj(
        "type" -> "Error",
        "error" -> x.error,
        "correlation" -> x.correlation)
  }
}

/**
 *
 */
object SocketActor {
  def props(user: User, out: ActorRef): Props = Props(new SocketActor(user, out))
}

class SocketActor(user: User, out: ActorRef) extends Actor {
  val SUBSCRIPTION_LIMIT = 256
  val COLLECTION_SUBSCRIPTION_LIMIT = 8

  var subscriptions = Set[String]()
  var collectionSubscriptions = Set[String]()

  def receive = {
    case msg@StatusUpdatedEvent(_, _, _) =>
      out ! Json.toJson(msg)

    case msg@ChildAddedEvent(_, _, _) =>
      out ! Json.toJson(msg)

    case msg@ChildRemovedEvent(_, _, _) =>
      out ! Json.toJson(msg)

    case msg@StreamDeletedEvent(uri, _) =>
      out ! Json.toJson(msg)

    case msg: JsValue =>
      implicit val correlation = (msg \ "correlation").asOpt[Int].getOrElse(0)
      ((__ \ "type").read[String]).reads(msg) map { x => x match {
        case "GetStatus" =>
          recieveGetStatusMessage(msg)

        case "Subscribe" =>
          recieveSubscribeMessage(msg)

        case "Unsubscribe" =>
          recieveUnsubscribeMessage(msg)

        case "SubscribeCollection" =>
          recieveSubscribeCollectionMessage(msg)

        case "UnsubscribeCollection" =>
          recieveUnsubscribeCollectionMessage(msg)

        case _ =>
          error("Unknown type.")
      }
    } recoverTotal { _ =>
        error("Could not process request.")
    }
  }

  private def recieveGetStatusMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "of").read[String]).reads(msg)
      .map(subscribe)
      .recoverTotal { _ =>
        error("Could not process request.")
      }

  private def recieveSubscribeMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[List[String]]).reads(msg)
      .map(subscribe)
      .recoverTotal { _ =>
        error("Could not process request.")
      }

  private def recieveUnsubscribeMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[List[String]]).reads(msg)
      .map(unsubscribe)
      .recoverTotal { _ =>
        error("Could not process request.")
      }

  private def recieveSubscribeCollectionMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[String]).reads(msg)
      .map(subscribeCollection)
      .recoverTotal { _ =>
        error("Could not process request.")
      }

  private def recieveUnsubscribeCollectionMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[String]).reads(msg)
      .map(unsubscribeCollection)
      .recoverTotal { _ =>
      error("Could not process request.")
    }

  private def error(message: String)(implicit correlation: Int) =
    out ! Json.toJson(SocketError(message, correlation))

  private def getStatus(uri: String)(implicit correlation: Int): Unit =
    models.Stream.findByUri(uri) map { stream =>
      out ! Json.toJson(CurrentStatusResponse(uri, stream.status))
    } getOrElse {
      error("No such stream.")
    }

  /**
   * Get the status of a stream.
   */
  private def getStatus(stream: models.Stream)(implicit correlation: Int): Unit =
    out ! Json.toJson(StatusUpdatedEvent(stream.uri, stream.status))

  /**
   * Subscribe to a stream's updates.
   *
   * Also gets the status of the target.
   */
  private def subscribe(targets: List[String])(implicit correlation: Int): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String)(implicit correlation: Int): Unit = {
    if (subscriptions.contains(target)) {
      getStatus(target)
      return
    }

    if (subscriptions.size >= SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      models.Stream.findByUri(target) map { stream =>
        StreamSupervisor.subscribe(self, target)
        subscriptions += target
        getStatus(stream)
      }
    }
  }

  /**
   * Unsubscribe from a stream's updates
   */
  private def unsubscribe(targets: List[String]) = {
    StreamSupervisor.unsubscribe(self, targets)
    subscriptions = subscriptions -- targets
  }

  /**
   * Subscribe to collection updates.
   */
  private def subscribeCollection(target: String)(implicit correlation: Int): Unit = {
    if (collectionSubscriptions.contains(target)) {
      return
    }

    if (collectionSubscriptions.size >= COLLECTION_SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      models.Stream.findByUri(target) map { stream =>
        collectionSubscriptions += target
        CollectionSupervisor.subscribeCollection(self, target)
      }
    }
  }

  /**
   * Unsubscribe from collection updates.
   */
  private def unsubscribeCollection(uri: String) = {
    CollectionSupervisor.unsubscribeCollection(self, uri)
  }
}

