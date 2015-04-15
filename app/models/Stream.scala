package models

import java.util.Date
import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.data.validation.Constraints
import org.mongodb.morphia.query.Query
import scala.collection.JavaConverters._
import scala.annotation.meta._

/**
 *
 */
@Entity
@Indexes(Array(new Index(value = "parentId, childId", unique=true)))
@SerialVersionUID(1)
case class ChildStream(
  @(Id @field)
  id: ObjectId,
  hierarchical: Boolean,
  parentId: ObjectId,
  childId: ObjectId,
  childName: String,
  childUri: String,
  created: Date)
{
  def this() = this(null, false, null, null, "", "", new Date(0))
}

object ChildStream
{
  import models.Serializable._

  implicit val streamWrites = new Writes[ChildStream] {
    def writes(x: ChildStream): JsValue = {
      Json.obj(
        "id" -> x.id,
        "parentId" -> x.parentId,
        "childId" -> x.childId,
        "childName" -> x.childName,
        "childUri" -> x.childUri,
        "created" -> x.created
      )
    }
  }
}

/**
 *
 */
@Entity
@SerialVersionUID(1)
case class Stream(
  @(Id @field)
  var id: ObjectId,

  @Constraints.Required
  @Constraints.MaxLength(64)
  @Constraints.MinLength(1)
  var name: String,

  @Constraints.Required
  @Constraints.MaxLength(2000)
  @Constraints.MinLength(1)
  @Indexed(unique=true)
  var uri: String,

  @Constraints.Required
  var created: Date,

  @Constraints.Required
  var updated: Date,

  @Embedded
  var status: Status,

  var ownerId: ObjectId)
{
  def this() = this(null, "", "", new Date(0), new Date(0), new Status(), null)

  def getOwner() =
    User.findById(this.ownerId)

  def getChildData() =
    Stream.getChildrenData(this)

  def getChildren() =
    Stream.getChildrenOf(this)
}


object Stream
{
  import models.Serializable._

  val streamNameCharacter = """[a-zA-Z0-9_\-$]"""

  val streamNamePattern = (streamNameCharacter + "{1,64}").r

  def isValidStreamName(name: String) =
    name.matches(streamNamePattern.toString)

  val maxChildren = 1000

  implicit val streamReads: Reads[Stream] = (
    (JsPath \ "id").read[ObjectId] and
      (JsPath \ "name").read[String] and
      (JsPath \ "uri").read[String] and
      (JsPath \ "created").read[Date] and
      (JsPath \ "updated").read[Date] and
      (JsPath \ "status").read[Status] and
      (JsPath \ "owner").read[ObjectId]
    )(Stream.apply _)

  implicit val streamWrites = new Writes[Stream] {
    def writes(x: Stream): JsValue = {
      Json.obj(
        "id" -> x.id,
        "name" -> x.name,
        "uri" -> x.uri,
        "created" -> x.created,
        "updated" -> x.updated,
        "status" -> x.status,
        "owner" -> x.ownerId)
    }
  }

  private def db(): Query[Stream] =
    MorphiaObject.datastore.createQuery((classOf[Stream]))

  private def childDb(): Query[ChildStream] =
    MorphiaObject.datastore.createQuery((classOf[ChildStream]))

  private def normalizeUri(uri: String) =
    uri.toLowerCase

  /**
   * Given a parent Stream and a child name, get the URI of the child.
   */
  def descendantUri(parent: Stream, childName: String) =
    normalizeUri(parent.uri + "/" + childName)

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
      .filter("id = ", id)
      .get())

  def findById(id: String): Option[Stream] =
    stringToObjectId(id).flatMap(findById)

  /**
   * Lookup a stream using its uri.
   */
  def findByUri(uri: String): Option[Stream] =
    Option(db()
      .filter("uri = ", normalizeUri(uri))
      .get())

  /**
   * Lookup streams using a search term.
   */
  def findByQuery(query: String): List[Stream] = {
    val q = db().limit(20)
    q.criteria("name")
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

  /**
   * Create a new stream with a given name.
   *
   * Name and uri should have already been validated at this point.
   */
  private def createStreamWithName(name: String, uri: String, owner: User): Option[Stream] =
    findByUri(uri) orElse {
      val created = new Date()
      save(Stream(null, name, normalizeUri(uri), created, created, Status.defaultStatus(owner.id), owner.id))
    }

  /**
   * Create a top level stream with a given name.
   *
   * Returns the existing child stream if it exists.
   */
  def createRootStream(name: String, owner: User): Option[Stream] =
    createStreamWithName(name, name, owner)

  /**
   * Create a descendant of an existing stream.
   *
   * Returns the existing child if it exists.
   */
  def createDescendant(parent: Stream, child: String, user: User): Option[models.Stream] =
    asEditable(user, parent) flatMap { stream =>
      findByParent(parent, child) orElse {
        createStreamWithName(child, descendantUri(parent, child), user)
      }
    }

  def createDescendant(parentUri: String, childName: String, user: User): Option[models.Stream] =
    findByUri(parentUri) flatMap { parentStream =>
      createDescendant(parentStream, childName, user)
    }

  /**
   * Registers a new child for a given stream.
   */
   def addChild(parent: Stream, child: Stream, user: User): Option[ChildStream] =
    asEditable(user, parent) flatMap { parent =>
      save(ChildStream(null, true, parent.id, child.id, child.name, child.uri, new Date()))
    }

  def addChild(parent: Stream, childId: ObjectId, user: User): Option[ChildStream] =
    findById(childId) flatMap { child =>
      addChild(parent, child, user)
    }

  /**
   * Remove an existing child.
   */
  def removeChild(parent: Stream, child: ObjectId) =
    MorphiaObject.datastore.delete(
      childDb()
        .filter("parentId =", parent.id)
        .filter("childId =", child))

  /**
   *
   */
  def updateStreamStatus(stream: Stream, color: String, poster: User): Option[Stream] = {
    if (color.matches(Status.colorPattern.toString())) {
      asEditable(poster, stream) flatMap { current =>
        val updated = new Date()
        current.status = Status(color, 0, updated, poster.id)
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
      .map(x => findById(x.childId).get)
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