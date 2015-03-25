package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.data.validation.Constraints
import play.api.libs.functional.syntax._


@SerialVersionUID(1L)
class Favorite(
  @Constraints.Required
  @Constraints.MaxLength(7)
  @Constraints.MinLength(7)
  @Constraints.Pattern("#[0-9a-fA-F]{6}")
  var color: String,

  @Constraints.Required
  @Constraints.Max(100)
  @Constraints.Min(0)
  var priority: Int,

  @Constraints.Required
  var created: Date,

  @Constraints.Required
  var posterId:ObjectId)
{
  def this() = this("#000000", 0, new Date(), null)
}

object Favorite extends models.Serializable {

  def apply(color: String, priority: Int, created: Date, posterId: ObjectId): Favorite =
    new Favorite(color, priority, created, posterId)

  def defaultFavorite(poster: ObjectId): Favorite =
    apply("#aaaaaa", 0, new Date(), poster)

  implicit val FavoriteReads: Reads[Favorite] =
    ((JsPath \ "color").read[String] and
      (JsPath \ "priority").read[Int] and
      (JsPath \ "created").read[Date] and
      (JsPath \ "poster").read[ObjectId]
      )(Favorite.apply _)

  implicit val FavoriteWrites = new Writes[Favorite] {
    def writes(x: Favorite): JsValue = {
      Json.obj(
        "color" -> x.color,
        "priority" -> x.priority,
        "created" -> x.created,
        "poster" -> x.posterId
      )
    }
  }
}