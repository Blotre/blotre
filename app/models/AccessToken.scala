package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import org.mongodb.morphia.query.Query

import scala.annotation.meta.field


@Entity
@SerialVersionUID(1)
case class AccessToken(
  @(Id @field)
  var id: ObjectId,

  var clientId: ObjectId,
  var userId: ObjectId,

  var accessToken: String,
  var refreshToken: String,

  var issued: Date,
  var expires: Long)
{
  val scope = "rw"

  def toScalaOauth2AccessToken() =
    scalaoauth2.provider.AccessToken(
      this.accessToken,
      Some(this.refreshToken),
      Some(this.scope),
      Some(this.expires),
      this.issued)

  def isExpired() =
    this.expires > (new Date().getTime - this.issued.getTime)
}


object AccessToken
{
  /**
   * Update or create the access token for a given client and user.
   */
  def updateAccessToken(clientId: ObjectId, userId: ObjectId, accessToken: String, refreshToken: String, issued: Date, expires: Long) =
    MorphiaObject.datastore.updateFirst(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId = ", clientId)
        .filter("userId = ", userId),
      MorphiaObject.datastore.createUpdateOperations[AccessToken](classOf[AccessToken])
        .set("clientId", clientId)
        .set("userId", userId)
        .set("accessToken", accessToken)
        .set("refreshToken", refreshToken)
        .set("issued", issued)
        .set("expires", expires),
      true)

  /**
   *
   */
  def findToken(clientId: ObjectId, user: User): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("clientId = ", clientId)
      .filter("userId = ", user.id)
      .get)

  /**
   *
   */
  def findByAccessToken(accessToken: String): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("accessToken = ", accessToken)
      .get)

  /**
   *
   */
  def findByRefreshToken(refreshToken: String): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("refreshToken = ", refreshToken)
      .get)


}