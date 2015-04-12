package Actors

import akka.actor._
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
 * Manages collection actors.
 *
 * Each collection in the system is represented by an actor.
 */
class CollectionSupervisor extends Actor
{
  def receive = {
    case GetCollection(uri) =>
      sender ! GetCollectionResponse(getOrCreateChild(uri))
  }

  private def getOrCreateChild(uri: String) = {
    val name = ActorHelper.normalizeName(uri)
    context.child(name) getOrElse (context.actorOf(CollectionActor.props(name), name = name))
  }
}

object CollectionSupervisor
{
  def props(): Props = Props(new CollectionSupervisor())

  lazy val supervisor = Akka.system.actorOf(props())

  implicit val timeout = Timeout(5 seconds)

  def getCollection(uri: String): Future[ActorRef] =
    ask(supervisor, GetCollection(uri)).mapTo[GetCollectionResponse].map(_.actor)

  def getCollectionState(uri: String, count: Int, offset: Int): Future[Seq[String]] =
    getCollection(uri) flatMap { collection =>
      ask(collection, GetCollectionStatus(count, offset)).mapTo[Seq[String]]
    }

}