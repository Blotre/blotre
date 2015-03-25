package models

import java.util.Date
import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.api.libs.functional.syntax._
import play.data.validation.Constraints
import org.mongodb.morphia.query.Query
import scala.collection.JavaConverters._

@Entity
@SerialVersionUID(1)
class Favorite {
  var streamId: ObjectId = _

  var ownerId: ObjectId = _

  @Constraints.Required
  var created: Date = _
}

object Favorite extends models.Serializable {
  def apply(id: ObjectId, created: Date, stream: ObjectId, owner: ObjectId): Favorite = {
    var s: Favorite = new Favorite();
    s.id = id;
    s.created = created;
    s.streamId = stream;
    s.ownerId = owner;
    return s;
  }

  implicit val streamReads: Reads[Favorite] = (
    (JsPath \ "id").read[ObjectId] and
      (JsPath \ "created").read[Date] and
      (JsPath \ "stream").read[ObjectId] and
      (JsPath \ "owner").read[ObjectId]
    )(Favorite.apply _)

  implicit val streamWrites = new Writes[Favorite] {
    def writes(x: Favorite): JsValue = {
      Json.obj(
        "id" -> x.id,
        "created" -> x.created,
        "owner" -> x.ownerId,
        "stream," -> x.streamId
      )
    }
  }

  private def db(): Query[Favorite] =
    MorphiaObject.datastore.createQuery((classOf[Favorite]))

  /**
   *
   */
  def findForUser(user: User, limit: Int = 20, offset: Int = 0): List[Favorite] =
    db()
      .filter("ownerId =", user.id)
      .order("updated")
      .offset(offset)
      .limit(limit)
      .asList()
      .asScala.toList


}