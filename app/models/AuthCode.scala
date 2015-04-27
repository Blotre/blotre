package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import org.mongodb.morphia.query.Query
import scala.annotation.meta.field
import scala.collection.JavaConverters._


@Entity
@SerialVersionUID(1)
case class AuthCode(
  @(Id @field) var id: ObjectId,

  var clientId: ObjectId,
  var userId: ObjectId,

  var code: String,

  var issued: Date,
  var expires: Long)
{
  val scope = "rw"

  def this() = this(null, null, null, "", new Date(0), 0)

  def isExpired(): Boolean =
    this.expires < ((new Date().getTime - this.issued.getTime) / 1000)

  def getClient(): Option[Client] =
    Client.findById(this.clientId)
}

object AuthCode
{
  val defaultExpiration = 60L * 60L

  /**
   * Lookup an authcode by id
   */
  def findById(id: ObjectId): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("id = ", id)
      .get)

  /**
   * Lookup an existing authcode by client and user.
   */
  def findByClient(client: Client, user: User): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("clientId = ", client.id)
      .filter("userId = ", user.id)
      .get)

  /**
   * Lookup an existing authcode by value.
   */
  def findByCode(code: String): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("code = ", code)
      .get)

  /**
   * Find all auth codes for a given user.
   */
  def getAuthCodesForUser(user: User): List[AuthCode] =
    MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("userId =", user.id)
      .asList()
      .asScala.toList

  /**
   * Update or create the auth code token for a given client and user.
   */
  private def updateAuthCode(clientId: ObjectId, userId: ObjectId, code: String, issued: Date, expires: Long) =
    MorphiaObject.datastore.updateFirst(
      MorphiaObject.datastore.createQuery(classOf[AuthCode])
        .filter("clientId = ", clientId)
        .filter("userId = ", userId),
      MorphiaObject.datastore.createUpdateOperations[AuthCode](classOf[AuthCode])
        .set("clientId", clientId)
        .set("userId", userId)
        .set("code", code)
        .set("issued", issued)
        .set("expires", expires),
      true)

  def refreshAuthCode(client: Client, user: User): Option[AuthCode] = {
    updateAuthCode(client.id, user.id, Crypto.generateToken, new Date(), defaultExpiration)
    findByClient(client, user)
  }


  /**
   * Delete all access tokens associated with a client.
   */
  def deleteAllForClient(client: Client) =
    MorphiaObject.datastore.delete(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId =", client.id))
}