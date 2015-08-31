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

      ((__ \ "type").read[String]).reads(msg) map {

      // Stream lookup
        case "GetStream" =>
          receiveMessage[GetStream](msg) { x =>
            getStream(x.uri)
          }

        case "GetStreams" =>
          receiveMessage[GetStreams](msg) { x =>
            getStreams(x.query.getOrElse(""))
          }

      // Stream.status
        case "GetStatus" =>
          receiveMessage[GetStatus](msg) { x =>
            getStatus(x.of)
          }

        case "SetStatus" =>
          receiveMessage[SetStatus](msg) { x =>
            setStatus(user, x.of, x.status)
          }

      // Stream operations
        case "CreateStream" =>
          receiveMessage[ApiCreateStreamData](msg) { x =>
            createStream(user, x.name, x.uri, x.status)
          }

        case "DeleteStream" =>
          receiveMessage[DeleteStream](msg) { x =>
            deleteStream(user, x.uri)
          }

      // Stream.children
        case "GetChildren" =>
          receiveMessage[GetChildren](msg) { x =>
            getChildren(x.of, x.query, 20, 0)
          }

        case "GetChild" =>
          receiveMessage[GetChild](msg) { x =>
            getChild(x.of, x.child)
          }

        case "CreateChild" =>
          receiveMessage[CreateChild](msg) { x =>
            createChild(user, x.of, x.child)
          }

        case "DeleteChild" =>
          receiveMessage[DeleteChild](msg) { x =>
            deleteChild(user, x.of, x.child)
          }

      // Stream.tags
        case "GetTags" =>
          receiveMessage[GetTags](msg) { x =>
            getTags(x.of)
          }

        case "SetTags" =>
          receiveMessage[SetTags](msg) { x =>
            setTags(user, x.of, x.tags)
          }

        case "GetTag" =>
          receiveMessage[GetTag](msg) { x =>
            getTag(x.of, x.tag)
          }

        case "SetTag" =>
          receiveMessage[SetTag](msg) { x =>
            setTag(user, x.of, x.tag)
          }

        case "DeleteTag" =>
          receiveMessage[DeleteTag](msg) { x =>
            deleteTag(user, x.of, x.tag)
          }

      // Subscriptions
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
    } recoverTotal { _ =>
        error("Could not process request.")
    }
  }

  /**
   * Translate an api result to the send/response socket API.
   */
  private def fromApi[T, R](response: ApiResult[T])(f: T => R)(implicit w: Writes[R], correlation: Int, acknowledge: Boolean) =
    response match {
      case ApiSuccess(result) => ack(f(result))
      case ApiFailure(e) => error(e.error)
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
   * Try to create a new stream.
   */
  private def createStream(user: models.User, name: String, uri: String, status: Option[ApiSetStatusData])(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.createStream(user, name, uri, status)) { stream =>
      StreamResponse(stream, correlation)
    }

  /**
   * Get the status of a stream.
   */
  private def getStream(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getStream(models.StreamKey.forUri(uri))) { stream =>
      StreamResponse(stream, correlation)
    }

  /**
   * Lookup streams with an optional query.
   */
  private def getStreams(query: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getStreams(query)) { streams =>
      StreamsResponse(streams, correlation)
    }

  /**
   * Delete a stream.
   */
  private def deleteStream(user: models.User, uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.apiDeleteStream(user, models.StreamKey.forUri(uri))) { stream =>
      StreamResponse(stream, correlation)
    }

  /**
   * Get the status of a stream.
   */
  private def getStatus(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getStreamStatus(models.StreamKey.forUri(uri))) { status =>
      StreamStatusResponse(uri, status, correlation)
    }

  /**
   * Get the tags of a stream.
   */
  private def getTags(uri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getTags(models.StreamKey.forUri(uri))) { tags =>
      StreamTagsResponse(uri, tags, correlation)
    }

  /**
   * Sets the tags of a stream.
   */
  private def setTags(user: models.User, uri: String, tags: api.ApiSetTagsData)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.setTags(user, models.StreamKey.forUri(uri), tags.tags)) { newTags =>
      StreamTagsResponse(uri, newTags, correlation)
    }

  /**
   * Get a tag of a stream.
   */
  private def getTag(uri: String, tag: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getTag(models.StreamKey.forUri(uri), tag)) { tag =>
      StreamTagResponse(uri, tag, correlation)
    }

  /**
   * Set a tag of a stream.
   */
  private def setTag(user: models.User, uri: String, tag: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.setTag(user, models.StreamKey.forUri(uri), tag)) { newTag =>
      StreamTagResponse(uri, newTag, correlation)
    }

  /**
   * Remove a tag from a stream.
   */
  private def deleteTag(user: models.User, uri: String, tag: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.removeTag(user, models.StreamKey.forUri(uri), tag)) { removedTag =>
      StreamTagResponse(uri, removedTag, correlation)
    }

  /**
   * Get the status of a stream.
   */
  private def setStatus(user: models.User, uri: String, status: ApiSetStatusData)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.setStreamStatus(user, models.StreamKey.forUri(uri), status)) { newStatus =>
      StreamStatusResponse(uri, newStatus, correlation)
    }

  /**
   * Get a child of stream.
   */
  private def getChild(uri: String, childUri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.getChild(models.StreamKey.forUri(uri), models.StreamKey.forUri(childUri))) { r =>
      StreamResponse(r, correlation)
    }

  /**
   * Get the children of a stream.
   */
  private def getChildren(uri: String, query: Option[String], limit: Int, offset: Int)(implicit correlation: Int, acknowledge: Boolean): Unit =
    StreamApi.getChildren(models.StreamKey.forUri(uri), query.getOrElse(""), limit, offset) map { r =>
      fromApi(r) { children =>
        ApiChildrenResponse(uri, children, correlation)
      }}

  /**
   * Get a child of stream.
   */
  private def createChild(user: models.User, uri: String, childUri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.createChild(user, models.StreamKey.forUri(uri), models.StreamKey.forUri(childUri))) { r =>
      StreamResponse(r, correlation)
    }

  /**
   * Get a child of stream.
   */
  private def deleteChild(user: models.User, uri: String, childUri: String)(implicit correlation: Int, acknowledge: Boolean): Unit =
    fromApi(StreamApi.apiDeleteChild(user, models.StreamKey.forUri(uri), models.StreamKey.forUri(childUri))) { r =>
      StreamResponse(r, correlation)
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

