package models

import java.util.Date
import java.util.Arrays
import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import org.mongodb.morphia.query._
import play.api.libs.json._
import play.api.libs.functional.syntax._
import org.mongodb.morphia.query.Query
import scala.collection.immutable._
import scala.collection.JavaConverters._
import scala.annotation.meta._

/**
 *
 */
@Entity
@Indexes(Array(new Index(value = "parentId, childId", unique=true)))
@SerialVersionUID(1)
case class ChildStream(
  @(Id @field) var id: ObjectId,
  hierarchical: Boolean,
  parentId: ObjectId,
  parentName: String,
  parentUri: String,
  childId: ObjectId,
  childName: String,
  childUri: String,
  created: Date)
{
  def this() = this(null, false, null, null, null, null, "", "", new Date(0))

  def getChildUri() =
    StreamUri(childUri)

  def getParentUri() =
    StreamUri(childUri)
}

/**
 *
 */
@Entity
@SerialVersionUID(1)
case class Stream(
  @(Id @field) var id: ObjectId,
  name: String,
  @Indexed(unique=true) uri: String,
  created: Date,
  var updated: Date,
  @Embedded var status: Status,
  ownerId: ObjectId,
  var childCount: Long,
  @Embedded var tags: java.util.List[String])
{
  def this() = this(null, "", "", new Date(0), new Date(0), new Status(), null, 0, new java.util.ArrayList[String]())

  def getOwner() =
    User.findById(this.ownerId)

  def isOwner(user: User) =
    user != null && this.ownerId == user.id

  def getChildData() =
    Stream.getChildrenData(this)

  def getChildren() =
    Stream.getChildrenOf(this)

  def getUri() =
    StreamUri(uri)

  def getTags() =
    this.tags.asScala.toList.map(StreamTag.apply)

  def hasTag(tag: StreamTag) =
    this.getTags().contains(tag)
}

object Stream
{
  import models.Serializable._

  /**
   * Maximum number of children a single stream can have.
   */
  val maxChildren = 1000

  /**
   * Maximum number of tags a single stream can have.
   */
  var maxTags = 6

  /**
   * Stream that belongs to a given user and is editable by them.
   */
  case class OwnedStream(stream: Stream, user: User)
  {
    def updateStatus(color: Color) =
      Stream.updateStreamStatus(stream, color, user)

    def createDescendant(childName: StreamName): Option[models.Stream] =
      Stream.createDescendant(stream, childName, user)

    def addChild(hierarchical: Boolean, child: Stream) =
      Stream.addChild(hierarchical, stream, child, user)

    def removeChild(child: ObjectId) =
      Stream.removeChild(stream, child)

    def setTags(tags: Seq[StreamTag]) =
      Stream.setTags(stream, tags)
  }

  /**
   * Try to create an owned stream.
   */
  def asOwner(stream: Stream, user: User): Option[OwnedStream] =
    if (stream.isOwner(user))
      Some(OwnedStream(stream, user))
    else
      None

  /**
   * Normalizes a string query to escape potential regular expressions.
   */
  def toValidQuery(query: String): Option[String] =
    StreamName.fromString(query) map { query =>
      query.value.replaceAllLiterally("$", "\\$")
    }

  implicit val streamWrites = new Writes[Stream] {
    def writes(x: Stream): JsValue =
      Json.obj(
        "id" -> x.id,
        "name" -> x.name,
        "uri" -> x.uri,
        "created" -> x.created,
        "updated" -> x.updated,
        "status" -> x.status,
        "owner" -> x.ownerId,
        "tags" -> x.getTags())
  }

  private def db(): Query[Stream] =
    MorphiaObject.datastore.createQuery((classOf[Stream]))

  private def childDb(): Query[ChildStream] =
    MorphiaObject.datastore.createQuery((classOf[ChildStream]))

  private def save[A](obj: A): Option[A] = {
    MorphiaObject.datastore.save[A](obj)
    Some(obj)
  }

  /**
   * Given a parent Stream and a child name, get the URI of the child.
   */
  private def descendantUri(parent: Stream, childName: StreamName): StreamUri =
    parent.getUri.addPath(childName)

  /**
   * Lookup a stream by id.
   */
  def findById(id: ObjectId): Option[Stream] =
    Option(db()
      .filter("id =", id)
      .get())

  def findById(id: String): Option[Stream] =
    stringToObjectId(id).flatMap(findById)

  /**
   * Lookup a stream using its uri.
   */
  def findByUri(uri: StreamUri): Option[Stream] =
    Option(db()
      .filter("uri =", uri.value)
      .get())

  def findByUri(uri: String): Option[Stream] =
    StreamUri.fromString(uri).flatMap(findByUri)

  /**
   * Lookup streams using a search term.
   *
   * TODO: order by score
   */
  def findByQuery(query: String): List[Stream] =
    toValidQuery(query) map { safeQuery =>
      val q = db().limit(20)
      q.criteria("name")
        .containsIgnoreCase(safeQuery)
      q.order("-updated").asList().asScala.toList
    } getOrElse {
      List()
    }

  /**
   * Lookup streams by status.
   *
   * TODO: order by score
   */
  def findByStatusQuery(query: String): List[Stream] = {
    val q = db().limit(20)
    q.criteria("status.color")
      .containsIgnoreCase(query)
    q.order("-updated").asList().asScala.toList
  }

  /**
   * Lookup streams by last updated time.
   */
  def findByUpdated(): List[Stream] =
    db()
      .order("-updated")
      .limit(20)
      .asList()
      .asScala.toList

  /**
   * Lookup a stream by its parent.
   */
  def findByParent(parent: Stream, childName: StreamName): Option[Stream] =
    Option(childDb()
      .filter("parentId =", parent.id)
      .filter("childName =", childName.value)
      .get()) flatMap (entry => findById(entry.childId))

  /**
   * Create a new stream with a given name.
   */
  private def createStreamWithName(name: StreamName, uri: StreamUri, owner: User): Option[Stream] =
    findByUri(uri) orElse {
      val created = new Date()
      val s = save(Stream(null, name.value, uri.value, created, created, Status.defaultStatus(owner.id), owner.id, 0, new java.util.ArrayList[String]()))
      User.incrementStreamCount(owner)
      s
    }

  /**
   * Create a top level stream with a given name.
   *
   * Returns the existing child stream if it exists.
   */
  def createRootStream(name: StreamName, owner: User): Option[Stream] =
    createStreamWithName(name, StreamUri.fromName(name), owner)

  /**
   * Create a descendant of an existing stream.
   *
   * Returns the existing child if it exists.
   */
  private def createDescendant(parent: Stream, childName: StreamName, user: User): Option[models.Stream] =
    findByParent(parent, childName) orElse {
      createStreamWithName(childName, descendantUri(parent, childName), user)
    }

  /**
   * Registers a new child for a given stream.
   */
  private def addChild(hierarchical: Boolean, parent: Stream, child: Stream, user: User): Option[ChildStream] = {
    val s = save(ChildStream(null, hierarchical, parent.id, parent.name, parent.uri, child.id, child.name, child.uri, new Date()))
    MorphiaObject.datastore.update(
      db().filter("id", parent.id),
      MorphiaObject.datastore.createUpdateOperations((classOf[Stream])).inc("childCount"))
    s
  }

  /**
   * Remove an existing child.
   */
  private def removeChild(parent: Stream, child: ObjectId): Unit = {
    MorphiaObject.datastore.delete(
      childDb()
        .filter("parentId =", parent.id)
        .filter("childId =", child))

    MorphiaObject.datastore.update(
      db().filter("id", parent.id),
      MorphiaObject.datastore.createUpdateOperations((classOf[Stream])).dec("childCount"))
  }

  def removeChild(childData: ChildStream): Unit =
    findById(childData.parentId).map(removeChild(_, childData.childId))

  /**
   * Set the status of a stream.
   */
  private def updateStreamStatus(stream: Stream, color: Color, poster: User): Option[Stream] = {
    val updated = new Date()
    stream.status = Status(color, updated, poster.id)
    stream.updated = updated
    save(stream)
  }

  /**
   * Set the tags of a stream.
   */
  private def setTags(stream: Stream, tags: Seq[StreamTag]): Option[Stream] = {
    val tagList = tags.map(_.value).asJava
    MorphiaObject.datastore.update(
      db().filter("id", stream.id),
      MorphiaObject.datastore.createUpdateOperations((classOf[Stream]))
        .set("updated", new Date())
        .set("tags", tagList))
    stream.tags = tagList
    Some(stream)
  }

  /**
   * Delete an existing stream.
   *
   * Caller should also clean up relationships before delete.
   */
  def deleteStream(stream: Stream): Unit = {
    MorphiaObject.datastore.delete(
      db()
        .filter("id =", stream.id))
    stream.getOwner.map(User.decrementStreamCount)
  }

  /**
   * Get data about all relationships a child is in.
   */
  def getRelations(child: Stream) =
    childDb()
      .filter("childId =", child.id)
      .asList()
      .asScala.toList

  /**
   * Get data about the children of a given stream.
   */
  def getChildrenData(parent: Stream) =
    childDb()
      .filter("parentId =", parent.id)
      .order("-created")
      .asList()
      .asScala.toList

  /**
   * Get all children of a given stream.
   */
  def getChildrenOf(parent: Stream): List[Stream] =
    getChildrenData(parent)
      .map(x => findById(x.childId).get)

  /**
   * Query the children of a given stream
   */
  def getChildrenByQuery(parent: Stream, query: String, limit: Int): List[Stream] = {
    val q = childDb().limit(limit).filter("parentId =", parent.id)
    q.criteria("childName")
      .containsIgnoreCase(query)
    q.asList()
      .asScala.toList
      .map(x => findById(x.childId)).flatten
  }

  /**
   * Lookup the child of a stream by the child's id.
   */
  def getChildById(parentId: ObjectId, childId: ObjectId): Option[ChildStream] =
    Option(childDb()
      .filter("parentId =", parentId)
      .filter("childId =", childId)
      .get)

  /**
   * Lookup children by tag.
   */
  def getStreamWithTag(tag: StreamTag, limit: Int): Seq[Stream] = {
    val q = db().limit(limit)
    q.field("tags").hasThisElement(tag.value)
    q.asList()
      .asScala.toList
  }

  /**
   * Lookup children by tag with a query
   */
  def searchStreamWithTag(tag: StreamTag, query: String, limit: Int): Seq[Stream] = {
    val q = db().limit(limit)
    q.field("tags").hasAnyOf(Arrays.asList(tag.value))
    q.criteria("name")
      .containsIgnoreCase(query)
    q.asList()
      .asScala.toList
  }

}