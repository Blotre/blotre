package Actors

import akka.actor._
import play.api.libs.json.{Json, JsValue}

/**
 *
 */
object SocketActor {
  def props(out: ActorRef): Props = Props(new SocketActor(out))
}

class SocketActor(out: ActorRef) extends Actor {
  val SUBSCRIPTION_LIMIT = 255

  var subscriptions = Set[String]()

  def receive = {
    case msg@StatusUpdate(_, _) =>
      out ! Json.toJson(msg)

    case msg: JsValue => {
      (msg \ "type").as[String] match {
        case "Subscribe" =>
          subscribe((msg \ "to").as[List[String]])

        case "Unsubscribe" =>
          unsubscribe((msg \ "to").as[List[String]])

        case _ =>
      }
    }
  }

  private def subscribe(targets: List[String]): Unit =
    targets.foreach(subscribe)

  private def subscribe(target: String): Unit = {
    if (subscriptions.contains(target) || subscriptions.size >= SUBSCRIPTION_LIMIT)
      return

    models.Stream.findByUri(target).map(current => {
      StreamSupervisor.subscribe(self, target)
      // notify of current status
      self ! Actors.StatusUpdate(target, current.status)
    })
  }

  private def unsubscribe(targets: List[String]) = {
    StreamSupervisor.unsubscribe(self, targets)
    subscriptions = subscriptions -- targets
  }
}

