package Actors

import akka.actor._
import controllers.{ApiSetStatusData, ApiCreateStreamData}
import models.User
import play.api.libs.concurrent.Execution.Implicits._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.mvc.Results

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
   * Try to create a new stream.
   */
  private def createStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData])(implicit correlation: Int): Unit =
    controllers.Stream.apiCreateStream(user, name, uri, status) match {
      case controllers.ApiSuccess(stream) =>
        output(StreamResponse(stream, correlation))

      case controllers.ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the status of a stream.
   */
  private def getStream(uri: String)(implicit correlation: Int): Unit =
    models.Stream.findByUri(uri) map { stream =>
      output(StreamResponse(stream, correlation))
    } getOrElse {
      error("No such stream.")
    }

  /**
   *
   */
  private def getStreams(query: String)(implicit correlation: Int): Unit =
    controllers.Stream.apiGetStreams(query) match {
      case controllers.ApiSuccess(streams) =>
        output(streams)

      case controllers.ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Delete a stream.
   */
  private def deleteStream(user: models.User, uri: String)(implicit correlation: Int): Unit =
    controllers.Stream.apiDeleteStream(user, uri) match {
      case controllers.ApiSuccess(stream) =>
        output(StreamResponse(stream, correlation))

      case controllers.ApiFailure(e) =>
        error(e.error)
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
  private def setStatus(user: models.User, uri: String, status: ApiSetStatusData)(implicit correlation: Int): Unit =
    controllers.Stream.apiSetStreamStatus(user, uri, status) match {
      case controllers.ApiSuccess(status) =>
        output(CurrentStatusResponse(uri, status, correlation))

      case controllers.ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the children of a stream.
   */
  private def getChildren(uri: String, limit: Int, offset: Int)(implicit correlation: Int): Unit =
    controllers.Stream.apiGetChildren(uri, "", limit, offset) map { x => x match {
      case controllers.ApiSuccess(children) =>
        output(ApiChildrenResponse(uri, children, correlation))

      case controllers.ApiFailure(e) =>
        error(e.error)
    }
    }

  /**
   * Subscribe to a stream's updates.
   *
   * Also gets the status of the target.
   */
  private def subscribe(targets: List[String])(implicit correlation: Int): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String)(implicit correlation: Int): Unit =
    subscribe(models.Stream.normalizeUri(target))

  private def subscribe(target: models.StreamUri)(implicit correlation: Int): Unit = {
    if (subscriptions.contains(target.value)) {
      statusUpdate(target.value)
      return
    }

    if (subscriptions.size >= SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      models.Stream.findByUri(target) map { stream =>
        StreamSupervisor.subscribe(self, target.value)
        subscriptions += target.value
        statusUpdate(stream)
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

