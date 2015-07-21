package models

import java.util.Date
import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import org.mongodb.morphia.query._
import play.api.libs.json._
import play.api.libs.functional.syntax._
import play.utils.UriEncoding
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
}

/**
 * A valid stream name.
 */
case class StreamName(value: String)


/**
 * A valid stream uri.
 */
case class StreamUri(value: String)

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
  var childCount: Long)
{
  def this() = this(null, "", "", new Date(0), new Date(0), new Status(), null, 0)

  def getOwner() =
    User.findById(this.ownerId)

  def getChildData() =
    Stream.getChildrenData(this)

  def getChildren() =
    Stream.getChildrenOf(this)
}

object Stream {
  import models.Serializable._

  val streamNameCharacter = """[ a-zA-Z0-9_\-$]"""

  val streamNamePattern = (streamNameCharacter + "{1,64}").r

  def toValidStreamName(name: String): Option[StreamName] = {
    val trimmed = name.trim()
    if (trimmed.matches(streamNamePattern.toString))
      Some(StreamName(trimmed))
    else
      None
  }

  def toValidStreamName(name: StreamUri): Option[StreamName] =
    toValidStreamName(name.value.replace("+", " "))

  /**
   *
   */
  def toValidQuery(query: String): Option[String] =
    toValidStreamName(query) map { query =>
      query.value.replaceAllLiterally("$", "\\$")
    }

  val maxChildren = 1000

  implicit val streamWrites = new Writes[Stream] {
    def writes(x: Stream): JsValue =
      Json.obj(
        "id" -> x.id,
        "name" -> x.name,
        "uri" -> x.uri,
        "created" -> x.created,
        "updated" -> x.updated,
        "status" -> x.status,
        "owner" -> x.ownerId)
  }

  private def db(): Query[Stream] =
    MorphiaObject.datastore.createQuery((classOf[Stream]))

  private def childDb(): Query[ChildStream] =
    MorphiaObject.datastore.createQuery((classOf[ChildStream]))

  def normalizeUri(uri: String): StreamUri =
    try
      if (uri == null)
        StreamUri("")
      else
        StreamUri(UriEncoding.decodePath(uri
          .trim()
          .replace(" ", "+")
          .toLowerCase
          .stripSuffix("/"),
          "UTF-8"))
    catch {
      case e: Throwable =>
        StreamUri("")
    }

  def normalizeUri(uri: StreamName): StreamUri =
    normalizeUri(uri.value)

  /**
   * Given a parent Stream and a child name, get the URI of the child.
   */
  def descendantUri(parent: Stream, childName: StreamName): StreamUri =
    normalizeUri(parent.uri + "/" + childName.value)

  /**
   * TODO: move to controller
   */
  def asEditable(poster: User, stream: Stream): Option[Stream] =
    if (stream != null && poster != null && stream.ownerId == poster.id)
      Some(stream)
    else
      None

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
    findByUri(normalizeUri(uri))

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
  def findByParent(parent: Stream, childName: String): Option[Stream] =
    Option(childDb()
      .filter("parentId =", parent.id)
      .filter("childName =", childName)
      .get()) flatMap (entry => findById(entry.childId))

  def findByParent(parent: Stream, name: StreamName): Option[Stream] =
    findByParent(parent, name.value)

  /**
   * Create a new stream with a given name.
   *
   * Name and uri should have already been validated at this point.
   */
  private def createStreamWithName(name: StreamName, uri: StreamUri, owner: User): Option[Stream] =
    findByUri(uri) orElse {
      val created = new Date()
      val s = save(Stream(null, name.value, uri.value, created, created, Status.defaultStatus(owner.id), owner.id, 0))
      User.incrementStreamCount(owner)
      s
    }

  /**
   * Create a top level stream with a given name.
   *
   * Returns the existing child stream if it exists.
   */
  def createRootStream(name: StreamName, owner: User): Option[Stream] =
    createStreamWithName(name, normalizeUri(name), owner)

  /**
   * Create a descendant of an existing stream.
   *
   * Returns the existing child if it exists.
   */
  def createDescendant(parent: Stream, childName: StreamName, user: User): Option[models.Stream] =
    asEditable(user, parent) flatMap { stream =>
      findByParent(parent, childName) orElse {
        createStreamWithName(childName, descendantUri(parent, childName), user)
      }
    }

  def createDescendant(parentUri: String, childName: StreamName, user: User): Option[models.Stream] =
    findByUri(parentUri) flatMap { parentStream =>
      createDescendant(parentStream, childName, user)
    }

  /**
   * Registers a new child for a given stream.
   */
  def addChild(hierarchical: Boolean, parent: Stream, child: Stream, user: User): Option[ChildStream] =
    asEditable(user, parent) flatMap { parent =>
      val s = save(ChildStream(null, hierarchical, parent.id, parent.name, parent.uri, child.id, child.name, child.uri, new Date()))
      MorphiaObject.datastore.update(
        db().filter("id", parent.id),
        MorphiaObject.datastore.createUpdateOperations((classOf[Stream])).inc("childCount"))
      s
    }

  def addChild(hierarchical: Boolean, parent: Stream, childId: ObjectId, user: User): Option[ChildStream] =
    findById(childId) flatMap { child =>
      addChild(hierarchical, parent, child, user)
    }

  /**
   * Remove an existing child.
   */
  def removeChild(parent: Stream, child: ObjectId): Unit = {
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
   *
   */
  def updateStreamStatus(stream: Stream, color: String, poster: User): Option[Stream] = {
    if (color.matches(Status.colorPattern.toString())) {
      asEditable(poster, stream) flatMap { current =>
        val updated = new Date()
        current.status = Status(color, updated, poster.id)
        current.updated = updated
        save(current)
      }
    } else {
      None
    }
  }

  def updateStreamStatus(uri: String, color: String, poster: User): Option[Stream] =
    findByUri(uri) flatMap { current =>
      updateStreamStatus(current, color, poster)
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
   * Remove all relationships that a stream appears in
   */
  private def deleteStreamRelationships(stream: Stream): Unit = {
    val q = childDb()
    q.or(
        q.criteria("parentId").equal(stream.id),
        q.criteria("childId").equal(stream.id))

    MorphiaObject.datastore.delete(q)
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
   * Lookup the child of a stream by the child's uri.
   */
  def getChildByUri(parent: Stream, childUri: String) =
    Option(childDb()
      .filter("parentId =", parent.id)
      .filter("childUri =", childUri)
      .get)

  private def save[A](obj: A): Option[A] = {
    MorphiaObject.datastore.save[A](obj)
    Some(obj)
  }
}