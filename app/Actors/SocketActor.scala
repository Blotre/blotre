package Actors

import akka.actor._
import models.User
import play.api.libs.json._

/**
 * Stream status update event.
 */
case class StatusUpdate(uri: String, status: models.Status)

object StatusUpdate
{
  implicit val statusWrites = new Writes[StatusUpdate] {
    def writes(x: StatusUpdate): JsValue =
      Json.obj(
        "type" -> "StatusUpdate",
        "stream" -> Json.obj(
          "uri" -> x.uri,
          "updated" -> x.status.created,
          "status" -> x.status))
  }
}

/**
 * Stream child added event.
 */
case class AddChildEvent(uri: String, childData: models.ChildStream)

object AddChildEvent extends
{
  import models.Serializable._

  implicit val addChildWrites = new Writes[AddChildEvent] {
    def writes(x: AddChildEvent): JsValue =
      Json.obj(
        "type" -> "AddChild",
        "stream" -> Json.obj(
          "uri" -> x.uri),
        "child" -> Json.obj(
          "id" -> x.childData.childId,
          "uri" -> x.childData.childUri,
          "added" -> x.childData.created
        ))
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
  val SUBSCRIPTION_LIMIT = 255

  var subscriptions = Set[String]()

  def receive = {
    case msg@StatusUpdate(_, _) =>
      out ! Json.toJson(msg)

    case GetCollectionResponse(col) =>
      out ! Json.obj("x" ->1)

    case msg: JsValue =>
      implicit val correlation = (msg \ "correlation").asOpt[Int].getOrElse(0)
      ((__ \ "type").read[String]).reads(msg) map { x => x match {
        case "Subscribe" =>
          recieveSubscribeMessage(msg)

        case "Unsubscribe" =>
          recieveUnsubscribeMessage(msg)

        case "SubscribeCollection" =>
          CollectionSupervisor.supervisor ! GetCollection("mb1")


        case "UnsubscribeCollection" =>
          //recieveUnsubscribeMessage(msg)

        case _ =>
          out ! Json.toJson(SocketError("Unknown type", correlation))
      }
    } recoverTotal { _ =>
        out ! Json.toJson(SocketError("Could not process request", correlation))
    }
  }

  private def recieveSubscribeMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[List[String]]).reads(msg)
      .map(subscribe)
      .recoverTotal { _ =>
        out ! Json.toJson(SocketError("Could not process request", correlation))
    }

  private def recieveUnsubscribeMessage(msg: JsValue)(implicit correlation: Int) =
    ((__ \ "to").read[List[String]]).reads(msg)
      .map(unsubscribe)
      .recoverTotal { _ =>
        out ! Json.toJson(SocketError("Could not process request", correlation))
      }

  private def subscribe(targets: List[String]): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String): Unit = {
    if (subscriptions.contains(target) || subscriptions.size >= SUBSCRIPTION_LIMIT)
      return

    models.Stream.findByUri(target).map(_ =>
      StreamSupervisor.subscribe(self, target))
  }

  private def unsubscribe(targets: List[String]) = {
    StreamSupervisor.unsubscribe(self, targets)
    subscriptions = subscriptions -- targets
  }
}

