package models

import org.bson.types.ObjectId
import play.api.libs.json._
import play.api.libs.functional.syntax._


object Serializable
{
  def stringToObjectId(id: String): Option[ObjectId] = try {
    Some(new ObjectId(id))
  } catch {
    case _: IllegalArgumentException => None
  }

  implicit val objectIdFormat: Format[ObjectId] = new Format[ObjectId] {
    def reads(json: JsValue) =
      json match {
        case jsString: JsString => {
          if (ObjectId.isValid(jsString.value))
            JsSuccess(new ObjectId(jsString.value))
          else
            JsError("Invalid ObjectId")
        }
        case other =>
          JsError("Can't parse json path as an ObjectId. Json content = " + other.toString())
      }

    def writes(oId: ObjectId): JsValue =
      JsString(oId.toString)
  }
}
