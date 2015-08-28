package Actors

import akka.actor._
import api._
import controllers.StreamApiController
import models.User
import play.api.libs.concurrent.Execution.Implicits._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.Logger

/**
 *
 */
case class SocketApiGetStreams(query: Option[String], limit: Option[Int], offset: Option[Int])

object SocketApiGetStreams
{
  implicit val socketApiGetStreamsReasds: Reads[SocketApiGetStreams] = (
    (JsPath \ "query").readNullable[String] and
      (JsPath \ "limit").readNullable[Int] and
      (JsPath \ "offset").readNullable[Int]
    )(SocketApiGetStreams.apply _)
}

/**
 *
 */
case class SocketApiGetStream(uri: String)

object SocketApiGetStream
{
  implicit val socketApiGetStreamReads: Reads[SocketApiGetStream] =
    (JsPath \ "uri").read[String].map(SocketApiGetStream.apply)
}

/**
 *
 */
case class SocketApiDeleteStream(uri: String)

object SocketApiDeleteStream
{
  implicit val socketApiDeleteStreamReads: Reads[SocketApiDeleteStream] =
    (JsPath \ "uri").read[String].map(SocketApiDeleteStream.apply)
}

/**
 *
 */
case class SocketApiGetStatus(of: String)

object SocketApiGetStatus
{
  implicit val socketApiGetStatusReads: Reads[SocketApiGetStatus] =
    (JsPath \ "of").read[String].map(SocketApiGetStatus.apply)
}

/**
 *
 */
case class SocketApiGetChildren(of: String, query: Option[String], limit: Option[Int], offset: Option[Int])

object SocketApiGetChildren
{
  implicit val socketApiGetChildrenReads: Reads[SocketApiGetChildren] = (
    (JsPath \ "of").read[String] and
    (JsPath \ "query").readNullable[String] and
    (JsPath \ "limit").readNullable[Int] and
    (JsPath \ "offset").readNullable[Int]
    )(SocketApiGetChildren.apply _)
}

/**
 *
 */
case class SocketApiSetStatus(of: String, status: ApiSetStatusData)

object SocketApiSetStatus
{
  implicit val socketApiSetStatusReads: Reads[SocketApiSetStatus] = (
    (JsPath \ "of").read[String] and
      (JsPath \ "status").read[ApiSetStatusData]
    )(SocketApiSetStatus.apply _)
}

/**
 *
 */
case class SocketApiSubscribe(to: List[String])

object SocketApiSubscribe
{
  implicit val socketApiSubscribeReads: Reads[SocketApiSubscribe] =
    (JsPath \ "to").read[List[String]].map(SocketApiSubscribe.apply)
}

/**
 *
 */
case class SocketApiSubscribeCollection(to: String)

object SocketApiSubscribeCollection
{
  implicit val socketApiSubscribeCollectionReads: Reads[SocketApiSubscribeCollection] =
    (JsPath \ "to").read[String].map(SocketApiSubscribeCollection.apply)
}

/**
 *
 */
object SocketActor
{
  def props(user: User, out: ActorRef): Props = Props(new SocketActor(user, out))
}

class SocketActor(user: User, out: ActorRef) extends Actor
{
  val SUBSCRIPTION_LIMIT = 256
  val COLLECTION_SUBSCRIPTION_LIMIT = 8

  var subscriptions = Set[String]()
  var collectionSubscriptions = Set[String]()
  
  override def postStop() {
    collectionSubscriptions.foreach(CollectionSupervisor.unsubscribeCollection(self, _))
  }

  /**
   * Write a value to the socket.
   */
  private def output[T](value: => T)(implicit w: Writes[T]) =
   out ! Json.toJson(value)

  /**
   * Write a success message to the socket.
   */
  private def ack[T](value: => T)(implicit w: Writes[T], acknowledge: Boolean) =
    if (acknowledge)
      output(value)

  /**
   * Write an error result to the socket.
   */
  private def error(message: String)(implicit correlation: Int) =
    output(SocketError(message, correlation))

  private def recieveMessage[T](msg: JsValue)(f: T => Unit)(implicit r: Reads[T], correlation: Int) =
    (Json.fromJson[T](msg)).fold(
      valid = f,
      invalid = e =>
        error("Could not process request."))

  def receive = {
    case msg: StatusUpdatedEvent => output(msg)
    case msg: ChildAddedEvent => output(msg)
    case msg: ChildRemovedEvent => output(msg)
    case msg: StreamDeletedEvent => output(msg)
    case msg: ParentAddedEvent => output(msg)
    case msg: ParentRemovedEvent => output(msg)

    case msg: JsValue =>
      implicit val correlation = (msg \ "correlation").asOpt[Int].getOrElse(0)
      implicit val acknowledge = (msg \ "acknowledge").asOpt[String].getOrElse("") != "error"

      ((__ \ "type").read[String]).reads(msg) map { x => x match {
        case "GetStreams" =>
          recieveMessage[SocketApiGetStreams](msg) { x =>
            getStreams(x.query.getOrElse(""))
          }

        case "CreateStream" =>
          recieveMessage[ApiCreateStreamData](msg) { x =>
            createStream(user, x.name, x.uri, x.status)
          }

        case "GetStream" =>
          recieveMessage[SocketApiGetStream](msg) { x =>
            getStream(x.uri)
          }

        case "DeleteStream" =>
          recieveMessage[SocketApiDeleteStream](msg) { x =>
            deleteStream(user, x.uri)
          }

        case "GetStatus" =>
          recieveMessage[SocketApiGetStatus](msg) { x =>
            getStatus(x.of)
          }

        case "SetStatus" =>
          recieveMessage[SocketApiSetStatus](msg) { x =>
            setStatus(user, x.of, x.status)
          }

        case "GetChildren" =>
          recieveMessage[SocketApiGetChildren](msg) { x =>
            getChildren(x.of, 20, 0)
          }

        case "Subscribe" =>
          recieveMessage[SocketApiSubscribe](msg) { x =>
            subscribe(x.to)
          }

        case "Unsubscribe" =>
          recieveMessage[SocketApiSubscribe](msg) { x =>
            unsubscribe(x.to)
          }
          
        case "SubscribeCollection" =>
          recieveMessage[SocketApiSubscribeCollection](msg) { x =>
            subscribeCollection(x.to)
          }

        case "UnsubscribeCollection" =>
          recieveMessage[SocketApiSubscribeCollection](msg) { x =>
            unsubscribeCollection(x.to)
          }

        case _ =>
          error("Unknown type.")
      }
    } recoverTotal { _ =>
        error("Could not process request.")
    }
  }

  /**
   * Try to create a new stream.
   */
  private def createStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData])(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.createStream(user, name, uri, status) match {
      case ApiSuccess(stream) =>
        ack(StreamResponse(stream, correlation))

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the status of a stream.
   */
  private def getStream(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.Stream.findByUri(uri) map { stream =>
      ack(StreamResponse(stream, correlation))
    } getOrElse {
      error("No such stream.")
    }

  /**
   *
   */
  private def getStreams(query: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.getStreams(query) match {
      case ApiSuccess(streams) =>
        ack(streams)

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Delete a stream.
   */
  private def deleteStream(user: models.User, uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.apiDeleteStream(user, uri) match {
      case ApiSuccess(stream) =>
        ack(StreamResponse(stream, correlation))

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the status of a stream.
   */
  private def getStatus(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.Stream.findByUri(uri) map (getStatus) getOrElse {
      error("No such stream.")
    }

  private def getStatus(stream: models.Stream)(implicit correlation: Int, acknowledge: Boolean): Unit =
    ack(CurrentStatusResponse(stream.uri, stream.status, correlation))

  private def statusUpdate(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.Stream.findByUri(uri) map (statusUpdate) getOrElse {
      error("No such stream.")
    }

  private def statusUpdate(stream: models.Stream)(implicit correlation: Int, acknowledge: Boolean): Unit =
    ack(StatusUpdatedEvent(stream.uri, stream.status, None))

  /**
   * Get the status of a stream.
   */
  private def setStatus(user: models.User, uri: String, status: ApiSetStatusData)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.apiSetStreamStatusForUri(user, uri, status) match {
      case ApiSuccess(status) =>
        ack(CurrentStatusResponse(uri, status, correlation))

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the children of a stream.
   */
  private def getChildren(uri: String, limit: Int, offset: Int)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.getChildren(uri, "", limit, offset) map {
      case ApiSuccess(children) =>
        ack(ApiChildrenResponse(uri, children, correlation))

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Subscribe to a stream's updates.
   *
   * Also gets the status of the target.
   */
  private def subscribe(targets: List[String])(implicit correlation: Int): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String)(implicit correlation: Int): Unit =
    models.StreamUri.fromString(target) map { uri =>
      subscribe(uri)
    }

  private def subscribe(target: models.StreamUri)(implicit correlation: Int): Unit = {
    if (subscriptions.contains(target.value)) {
      statusUpdate(target.value)(correlation, true)
      return
    }

    if (subscriptions.size >= SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      models.Stream.findByUri(target) map { stream =>
        StreamSupervisor.subscribe(self, target.value)
        subscriptions += target.value
        statusUpdate(stream)(correlation, true)
      }
    }
  }

  /**
   * Unsubscribe from a stream's updates
   */
  private def unsubscribe(targets: List[String]): Unit = {
    StreamSupervisor.unsubscribe(self, targets)
    subscriptions = subscriptions -- targets
  }

  /**
   * Subscribe to collection updates.
   */
  private def subscribeCollection(target: String)(implicit correlation: Int): Unit = {
    if (collectionSubscriptions.contains(target))
      return

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
  private def unsubscribeCollection(uri: String): Unit = {
    CollectionSupervisor.unsubscribeCollection(self, uri)
    collectionSubscriptions -= uri
  }
}

