package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.data.validation.Constraints
import play.api.libs.functional.syntax._


@Embedded
@SerialVersionUID(1L)
class Status(
  val color: String,
  val created: Date,
  val posterId: ObjectId)
{
  def this() = this("#000000", new Date(), null)
}

object Status
{
  import models.Serializable._

  val colorPattern = """#[0-9a-fA-F]{6}""".r

  def apply(color: String, created: Date, posterId: ObjectId): Status =
    new Status(color.toLowerCase, created, posterId)

  def defaultStatus(poster: ObjectId): Status =
    apply("#aaaaaa",  new Date(), poster)

  implicit val statusReads: Reads[Status] =
    ((JsPath \ "color").read[String] and
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