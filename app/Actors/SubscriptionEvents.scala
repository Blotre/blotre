package Actors

import play.api.libs.json._

/**
 * Stream status update event.
 */
case class StatusUpdatedEvent(uri: models.StreamUri, status: models.Status, source: Option[String] = None)

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
case class StreamDeletedEvent(uri: models.StreamUri, source: Option[String] = None)

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
case class ChildAddedEvent(uri: Address, child: models.Stream, source: Option[String] = None)

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
 * Stream added as the child of a stream.
 */
case class ParentAddedEvent(uri: models.StreamUri, parent: Address, source: Option[String] = None)

object ParentAddedEvent extends
{
  implicit val parentAddedEventWrites = new Writes[ParentAddedEvent] {
    def writes(x: ParentAddedEvent): JsValue =
      Json.obj(
        "type" -> "ParentAdded",
        "from" -> x.uri,
        "parent" -> x.parent,
        "source" -> x.source)
  }
}

/**
 * Stream child removed event.
 */
case class ChildRemovedEvent(uri: Address, child: models.StreamUri, source: Option[String] = None)

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
 * Stream removed as the child of a stream.
 */
case class ParentRemovedEvent(uri: models.StreamUri, parent: Address, source: Option[String] = None)

object ParentRemovedEvent extends
{
  implicit val parentAddedEventWrites = new Writes[ParentRemovedEvent] {
    def writes(x: ParentRemovedEvent): JsValue =
      Json.obj(
        "type" -> "ParentRemoved",
        "from" -> x.uri,
        "parent" -> x.parent,
        "source" -> x.source)
  }
}