package models

import java.util.Date
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import play.api.libs.json._
import play.data.validation.Constraints
import play.api.libs.functional.syntax._


@SerialVersionUID(1L)
class Alert(
      var message: String,
      var link: String)
{
  def this() = this("", "")
}

object Alert extends models.Serializable {

  def apply(message: String, link: String): Alert =
    Alert(message, link);

  implicit val alertReads: Reads[Alert] =
    ((JsPath \ "message").read[String] and
      (JsPath \ "link").read[String]
      )(Alert.apply _)
}