package Actors

import akka.actor._
import models.User
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.mvc.Results

/**
 *
 */
case class SocketApiSetStatus(of: String, status: controllers.Stream.ApiSetStatusData)

object SocketApiSetStatus
{
  implicit val socketApiSetStatusReads: Reads[SocketApiSetStatus] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "status").read[controllers.Stream.ApiSetStatusData]
    )(SocketApiSetStatus.apply _)
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

  /**
   * Write a result to the socket.
   */
  private def output[T](value: T)(implicit w: Writes[T])=
   out ! Json.toJson(value)

  /**
   * Write an error result to the socket.
   */
  private def error(message: String)(implicit correlation: Int) =
    output(SocketError(message, correlation))

  def receive = {
    case msg@StatusUpdatedEvent(_, _, _) =>
     output(msg)

    case msg@ChildAddedEvent(_, _, _) =>
     output(msg)

    case msg@ChildRemovedEvent(_, _, _) =>
     output(msg)

    case msg@StreamDeletedEvent(_, _) =>
     output(msg)

    case msg@ParentAddedEvent(_, _, _) =>
     output(msg)

    case msg@ParentRemovedEvent(_, _, _) =>
     output(msg)

    case msg: JsValue =>
      implicit val correlation = (msg \ "correlation").asOpt[Int].getOrElse(0)
      ((__ \ "type").read[String]).reads(msg) map { x => x match {
        case "GetStatus" =>
          recieveGetStatusMessage(msg)

        case "SetStatus" =>
          recieveSetStatusMessage(msg)

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

  private def recieveSetStatusMessage(msg: JsValue)(implicit correlation: Int) =
    (Json.fromJson[SocketApiSetStatus](msg)).fold(
      valid = x =>
        setStatus(user, x.of, x.status),
      invalid = e =>
        error("Could not process request."))

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

  /**
   * Get the status of a stream.
   */
  private def getStatus(uri: String)(implicit correlation: Int): Unit =
    models.Stream.findByUri(uri) map (getStatus) getOrElse {
      error("No such stream.")
    }

  private def getStatus(stream: models.Stream)(implicit correlation: Int): Unit =
    output(CurrentStatusResponse(stream.uri, stream.status, correlation))

  private def statusUpdate(uri: String)(implicit correlation: Int): Unit =
    models.Stream.findByUri(uri) map (statusUpdate) getOrElse {
      error("No such stream.")
    }

  private def statusUpdate(stream: models.Stream)(implicit correlation: Int): Unit =
    output(StatusUpdatedEvent(stream.uri, stream.status, None))

  /**
   * Get the status of a stream.
   */
  private def setStatus(user: models.User, uri: String, status: controllers.Stream.ApiSetStatusData)(implicit correlation: Int): Unit =
    models.Stream.findByUri(uri) map { stream =>
      controllers.Stream.apiSetStreamStatus(user, stream, status) match {
        case controllers.ApiSuccess(x) =>
          output(SocketSuccess(correlation))

        case controllers.ApiFailure(e) =>
          error(e.error)
      }
    } getOrElse(error("Stream does not exist."))

  /**
   * Subscribe to a stream's updates.
   *
   * Also gets the status of the target.
   */
  private def subscribe(targets: List[String])(implicit correlation: Int): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String)(implicit correlation: Int): Unit = {
    if (subscriptions.contains(target)) {
      statusUpdate(target)
      return
    }

    if (subscriptions.size >= SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      models.Stream.findByUri(target) map { stream =>
        StreamSupervisor.subscribe(self, target)
        subscriptions += target
        statusUpdate(stream)
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

