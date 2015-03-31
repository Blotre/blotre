package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import org.mongodb.morphia.query.Query

import scala.annotation.meta.field


@Entity
@SerialVersionUID(1)
case class AuthCode(
  @(Id @field)
  var id: ObjectId,

  var clientId: ObjectId,
  var userId: ObjectId,

  var code: String,
  var redirectUri: String,

  var issued: Date,
  var expires: Long)
{
  val scope = "rw"
}


object AuthCode
{
  /**
   *
   */
  def findByCode(code: String): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("code = ", code)
      .get) flatMap { authCode =>
        if (authCode.expires > new Date().getTime - authCode.expires) Some(authCode) else None
      }

}