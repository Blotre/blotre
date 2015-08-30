package api.socket

import Actors._
import akka.actor._
import api._
import models.User
import play.api.libs.concurrent.Execution.Implicits._
import play.api.libs.json.Reads._
import play.api.libs.json._

/**
 *
 */
object SocketActor {
  def props(user: User, out: ActorRef): Props = Props(new SocketActor(user, out))
}

class SocketActor(user: User, out: ActorRef) extends Actor
{
  val SUBSCRIPTION_LIMIT = 256
  val COLLECTION_SUBSCRIPTION_LIMIT = 8

  private var subscriptions = Set[models.StreamUri]()
  private var collectionSubscriptions = Set[Actors.Address]()
  
  override def postStop() {
    collectionSubscriptions.foreach(unsubscribeCollection)
  }

  /**
   * Write a value to the socket.
   */
  private def output[T](value: => T)(implicit w: Writes[T]): Unit =
    out ! Json.toJson(value)

  /**
   * Write a success message to the socket.
   */
  private def ack[T](value: => T)(implicit w: Writes[T], acknowledge: Boolean): Unit =
    if (acknowledge)
      output(value)

  /**
   * Write an error result to the socket.
   */
  private def error(message: String)(implicit correlation: Int): Unit =
    output(SocketError(message, correlation))

  /**
   * Parse a Json message an invoke f with the result.
   */
  private def receiveMessage[T](msg: JsValue)(f: T => Unit)(implicit r: Reads[T], correlation: Int): Unit =
    Json.fromJson[T](msg).fold(
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
          receiveMessage[GetStreams](msg) { x =>
            getStreams(x.query.getOrElse(""))
          }

        case "CreateStream" =>
          receiveMessage[ApiCreateStreamData](msg) { x =>
            createStream(user, x.name, x.uri, x.status)
          }

        case "GetStream" =>
          receiveMessage[GetStream](msg) { x =>
            getStream(x.uri)
          }

        case "DeleteStream" =>
          receiveMessage[DeleteStream](msg) { x =>
            deleteStream(user, x.uri)
          }

        case "GetStatus" =>
          receiveMessage[GetStatus](msg) { x =>
            getStatus(x.of)
          }

        case "SetStatus" =>
          receiveMessage[SetStatus](msg) { x =>
            setStatus(user, x.of, x.status)
          }

        case "GetTags" =>
          receiveMessage[GetTags](msg) { x =>
            getTags(x.of)
          }

        case "SetTags" =>
          receiveMessage[SetTags](msg) { x =>
            setTags(user, x.of, x.tags)
          }

        case "GetChildren" =>
          receiveMessage[GetChildren](msg) { x =>
            getChildren(x.of, 20, 0)
          }

        case "Subscribe" =>
          receiveMessage[Subscribe](msg) { x =>
            subscribe(x.to)
          }

        case "Unsubscribe" =>
          receiveMessage[Subscribe](msg) { x =>
            unsubscribe(x.to)
          }
          
        case "SubscribeCollection" =>
          receiveMessage[SubscribeCollection](msg) { x =>
            subscribeCollection(x.to)
          }

        case "UnsubscribeCollection" =>
          receiveMessage[SubscribeCollection](msg) { x =>
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
    StreamApi.getStream(models.StreamKey.forUri(uri)) match {
      case ApiSuccess(streams) =>
        ack(StreamResponse(streams, correlation))

      case ApiFailure(e) =>
        error(e.error)
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
    StreamApi.apiDeleteStream(user, models.StreamKey.forUri(uri)) match {
      case ApiSuccess(stream) =>
        ack(StreamResponse(stream, correlation))

      case ApiFailure(e) =>
        error(e.error)
    }

  /**
   * Get the status of a stream.
   */
  private def getStatus(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.Stream.findByUri(uri) map getStatus getOrElse {
      error("No such stream.")
    }

  private def getStatus(stream: models.Stream)(implicit correlation: Int, acknowledge: Boolean): Unit =
    ack(CurrentStatusResponse(stream.uri, stream.status, correlation))

  /**
   * Get the tags of a stream.
   */
  private def getTags(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.StreamUri.fromString(uri) map { uri =>
      StreamApi.getTags(uri) match {
        case ApiSuccess(tags) =>
          ack(StreamTagResponse(tags, correlation))

        case ApiFailure(e) =>
          error(e.error)
      }
    } getOrElse {
      error("No such stream.")
    }

  private def setTags(user: models.User, uri: String, tags: api.ApiSetTagsData)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.StreamUri.fromString(uri) map { uri =>
      StreamApi.setTags(user, uri, tags.tags) match {
        case ApiSuccess(newTags) =>
          ack(StreamTagResponse(newTags, correlation))

        case ApiFailure(e) =>
          error(e.error)
      }
    } getOrElse {
      error("No such stream.")
    }

  /**
   * Broadcast a status update message for a stream
   */
  private def statusUpdate(uri: models.StreamUri)(implicit correlation: Int, acknowledge: Boolean): Unit =
    models.Stream.findByUri(uri) map statusUpdate getOrElse {
      error("No such stream.")
    }

  private def statusUpdate(stream: models.Stream)(implicit correlation: Int, acknowledge: Boolean): Unit =
    ack(StatusUpdatedEvent(stream.getUri(), stream.status, None))

  /**
   * Get the status of a stream.
   */
  private def setStatus(user: models.User, uri: String, status: ApiSetStatusData)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.setStreamStatus(user, models.StreamKey.forUri(uri), status) match {
      case ApiSuccess(newStatus) =>
        ack(CurrentStatusResponse(uri, newStatus, correlation))

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
    models.StreamUri.fromString(target).foreach(subscribe)

  private def subscribe(target: models.StreamUri)(implicit correlation: Int): Unit = {
    if (subscriptions.contains(target)) {
      statusUpdate(target)(correlation, true)
      return
    }

    if (subscriptions.size >= SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      StreamSupervisor.subscribeStream(self, target)
      subscriptions += target
      statusUpdate(target)(correlation, true)
    }
  }

  /**
   * Unsubscribe from a stream's updates
   */
  private def unsubscribe(targets: List[String])(implicit correlation: Int): Unit =
    unsubscribe(targets.flatMap(models.StreamUri.fromString))

  private def unsubscribe(targets: List[models.StreamUri]): Unit = {
    StreamSupervisor.unsubscribeStream(self, targets)
    subscriptions = subscriptions -- targets
  }

  /**
   * Subscribe to collection updates.
   */
  private def subscribeCollection(target: String)(implicit correlation: Int): Unit =
    Actors.Address.fromUser(target).foreach(subscribeCollection)

  private def subscribeCollection(target: Actors.Address)(implicit correlation: Int): Unit = {
    if (collectionSubscriptions.contains(target))
      return

    if (collectionSubscriptions.size >= COLLECTION_SUBSCRIPTION_LIMIT) {
      error("Subscription limit exceeded.")
    } else {
      collectionSubscriptions += target
      CollectionSupervisor.subscribeCollection(self, target)
    }
  }

  /**
   * Unsubscribe from collection updates.
   */
  private def unsubscribeCollection(target: String)(implicit correlation: Int): Unit =
    Actors.Address.fromUser(target).foreach(unsubscribeCollection)

  private def unsubscribeCollection(target: Actors.Address): Unit = {
    CollectionSupervisor.unsubscribeCollection(self, target)
    collectionSubscriptions -= target
  }
}

