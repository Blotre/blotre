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

@Entity
@SerialVersionUID(1)
class Stream {
  @Id
  var id: ObjectId = _

  @Constraints.Required
  @Constraints.MaxLength(255)
  @Constraints.MinLength(1)
  var name: String = _

  @Constraints.Required
  @Constraints.MaxLength(2000)
  @Constraints.MinLength(1)
  @Indexed(unique=true)
  var uri: String = _

  @Constraints.Required
  var created: Date = _

  @Constraints.Required
  var updated: Date = _

  @Embedded
  var status: Status = _

  var ownerId: ObjectId = _

  @PrePersist
  def prePersist() {
    updated = new Date()
  }

  def getOwner(id: ObjectId) = User.findById(id)
}

object Stream extends models.Serializable {
  def apply(id: ObjectId, name: String, uri: String, created: Date, updated: Date, status: Status,
            owner: ObjectId): Stream = {
    var s: Stream = new Stream();
    s.id = id;
    s.name = name;
    s.uri = uri;
    s.created = created;
    s.updated = updated;
    s.status = status;
    s.ownerId = owner;
    return s;
  }

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
    MorphiaObject.datastore.createQuery((classOf[Stream]));

  def canUpdate(poster: User, stream: Stream) =
    stream != null && poster != null && stream.ownerId == poster.id;

  /**
   *
   */
  def findByUri(uri: String) =
    db()
      .filter("uri = ", uri)
      .get();

  /**
   *
   */
  def createStreamWithName(name: String, uri: String, ownerId: ObjectId) =
    MorphiaObject.datastore.save[Stream](
      Stream(null, name, uri, new Date(), new Date(), Status.defaultStatus(ownerId), ownerId));

  /**
   *
   */
  def updateStreamStatus(uri: String, color: String, poster: User): Option[Stream] = {
    val current = findByUri(uri)
    if (canUpdate(poster, current)) {
      current.status = Status(color, 0, new Date(), poster.id)
      MorphiaObject.datastore.save[Stream](current)
      return Some(current)
    }
    return None
  }


  /**
   *
   */
  def findByQuery(query: String): List[Stream] = {
    val q = db().limit(20);
    q.criteria("name")
      .containsIgnoreCase(query)
    q.asList().asScala.toList
  }

  /**
   *
   */
  def findByUpdated(): List[Stream] = {
    val results: java.util.List[Stream] = db()
      .order("updated")
      .limit(20)
      .asList();
    results.asScala.toList
  }


}