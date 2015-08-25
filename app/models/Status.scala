package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.data.validation.ValidationError
import play.api.libs.json._
import play.api.libs.functional.syntax._

/**
 * Validated stream color.
 */
case class Color(value: String)

object Color
{
  val pattern = """#[0-9a-fA-F]{6}""".r

  val default = Color("#aaaaaa")
  val none = Color("#000000")

  def readColor = Reads.StringReads.filter(ValidationError("Color is not valid."))(_.matches(Color.pattern.toString))

  /**
   * Try to create a color from a string.
   */
  def fromString(value: String): Option[Color] =
    if (value.matches(pattern.toString))
      Some(Color(value.toLowerCase))
    else
      None
}

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

  private def create(color: String, created: Date, posterId: ObjectId): Status =
    new Status(color, created, posterId)

  def apply(color: Color, created: Date, posterId: ObjectId): Status =
    create(color.value, created, posterId)

  def defaultStatus(poster: ObjectId): Status =
    apply(Color.default, new Date(), poster)

  implicit val statusReads: Reads[Status] =
    ((JsPath \ "color").read[String](Color.readColor) and
      (JsPath \ "created").read[Date] and
      (JsPath \ "poster").read[ObjectId]
    )(Status.create _)

  implicit val statusWrites = new Writes[Status] {
    def writes(x: Status): JsValue =
      Json.obj(
        "color" -> x.color,
        "created" -> x.created,
        "poster" -> x.posterId)
  }
}