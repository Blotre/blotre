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

@Entity
@SerialVersionUID(1)
case class Stream(
  @(Id @field)
  var id: ObjectId,

  @Constraints.Required
  @Constraints.MaxLength(255)
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

  def getOwner() = User.findById(this.ownerId)

  def getChildren() = Stream.getChildrenOf(this)
}

@Entity
@SerialVersionUID(1)
case class ChildStream(
  @(Id @field)
  id: ObjectId,
  parentId: ObjectId,
  childId: ObjectId,
  childName: String,
  childUri: String,
  created: Date)
{
  def this() = this(null, null, null, "", "", new Date(0))
}

object Stream extends models.Serializable {
  val streamNamePattern = """[a-zA-Z0-9_\-$]+""".r

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
        "owner" -> x.ownerId
      )
    }
  }

  private def db(): Query[Stream] =
    MorphiaObject.datastore.createQuery((classOf[Stream]))

  private def childDb(): Query[ChildStream] =
    MorphiaObject.datastore.createQuery((classOf[ChildStream]))

  /**
   * Given a parent Stream and a child name, get the URI of the child.
   */
  def descendantUri(parent: Stream, childName: String) =
    parent.uri + "/" + childName


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

  /**
   * Lookup a stream using its uri.
   */
  def findByUri(uri: String): Option[Stream] =
    Option(db()
      .filter("uri = ", uri)
      .get())

  /**
   * Lookup streams using a search term.
   */
  def findByQuery(query: String): List[Stream] = {
    val q = db().limit(20);
    q.criteria("name")
      .containsIgnoreCase(query)
    q.asList().asScala.toList
  }

  /**
   * Lookup streams by last updated time.
   */
  def findByUpdated(): List[Stream] =
    db()
      .order("updated")
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
      val s = Stream(null, name, uri, created, created, Status.defaultStatus(owner.id), owner.id)
      MorphiaObject.datastore.save[Stream](s)
      Some(s)
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
        createStreamWithName(child, descendantUri(parent, child), user) map { childStream =>
          addChild(parent, childStream)
          childStream
        }
      }
    }

  def createDescendant(parentUri: String, childName: String, user: User): Option[models.Stream] =
    findByUri(parentUri) flatMap { parentStream =>
      createDescendant(parentStream, childName, user)
    }

  /**
   * Registers a new child for a given stream.
   */
  private def addChild(parent: Stream, child: Stream) = {
    val entry = ChildStream(null, parent.id, child.id, child.name, child.uri, new Date())
    MorphiaObject.datastore.save[ChildStream](entry)
  }

  /**
   *
   */
  def updateStreamStatus(uri: String, color: String, poster: User): Option[Stream] =
    findByUri(uri) flatMap { current => {
      asEditable(poster, current) map { current =>
        val updated = new Date()
        current.status = Status(color, 0, updated, poster.id)
        current.updated = updated
        MorphiaObject.datastore.save[Stream](current)
        current
      }
    }}

  /**
   * Get all children of a given stream.
   */
  def getChildrenOf(parent: Stream) =
    childDb()
      .filter("parentId =", parent.id)
      .asList()
      .asScala.toList
      .map(x => findById(x.childId).get)

}