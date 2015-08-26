package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.api.libs.functional.syntax._

/**
 * Status of a stream.
 */
@Embedded
@SerialVersionUID(1L)
class Status(
  val color: String,
  val created: Date,
  val posterId: ObjectId)
{
  def this() = this(Color.none.value, new Date(), null)

  def GetColor() = this.color
}

object Status
{
  import models.Serializable._

  def apply(color: Color, created: Date, posterId: ObjectId): Status =
    new Status(color.value, created, posterId)

  def defaultStatus(poster: ObjectId): Status =
    apply(Color.default, new Date(), poster)

  implicit val statusReads: Reads[Status] =
    ((JsPath \ "color").read(Color.readColor) and
      (JsPath \ "created").read[Date] and
      (JsPath \ "poster").read[ObjectId]
    )(Status.apply _)

  implicit val statusWrites = new Writes[Status] {
    def writes(x: Status): JsValue =
      Json.obj(
        "color" -> x.color,
        "created" -> x.created,
        "poster" -> x.posterId)
  }
}