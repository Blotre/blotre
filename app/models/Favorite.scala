package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.api.libs.functional.syntax._

@SerialVersionUID(1L)
@Entity
case class Favorite(
  userId: ObjectId,
  streamId: ObjectId,
  created: Date)
{ }

object Favorite extends models.Serializable {

  implicit val FavoriteWrites = new Writes[Favorite] {
    def writes(x: Favorite): JsValue =
      Json.obj(
        "user" -> x.userId,
        "stream" -> x.streamId,
        "created" -> x.created)
  }
}