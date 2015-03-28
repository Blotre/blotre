package Actors

import akka.actor._
import scala.collection.SortedMap
import java.util.Date
import scala.collection.mutable.SortedSet


case class GetCollectionStatus(name: String, offset: Int, size: Int)

case class GetCollectionStatusResponse(name: String, values: List[String])

object CollectionActor
{
  def props(name: String): Props = Props(new CollectionActor(name))
}

/**
 *
 */
class CollectionActor(name: String) extends Actor
{
  case class Updated(name: String, updated: Date)

  private var state = Map[String, models.Status]()

  private var updated = SortedSet[Updated]()(Ordering.by[Updated, Date](_.updated))

  def receive = {
    case GetCollectionStatus(_, offset, size) =>
  }
}
