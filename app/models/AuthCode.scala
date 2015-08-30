package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import scala.collection.JavaConverters._


@Entity
class AuthCode extends Token
{
  def expire() = {
    this.expires = 0
    MorphiaObject.datastore.save[AuthCode](this)
  }
}

object AuthCode
{
  val defaultExpiration = 60L * 60L

  /**
   * Lookup an existing authcode by client and user.
   */
  private def findAnyByClient(client: Client, user: User, redirectUri: String): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("clientId = ", client.id)
      .filter("userId = ", user.id)
      .filter("redirectUri = ", redirectUri)
      .get)

  def findByClient(client: Client, user: User, redirectUri: String): Option[AuthCode] =
    findAnyByClient(client, user, redirectUri).filterNot(_.isExpired)

  /**
   * Lookup an existing authcode by value.
   */
  private def findAnyByCode(code: String, redirectUri: String): Option[AuthCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("token =", code)
      .filter("redirectUri =", redirectUri)
      .get)

  /**
   * Lookup an existing authcode by value.
   */
  def findByCode(code: String, redirectUri: String): Option[AuthCode] =
    findAnyByCode(code, redirectUri).filterNot(_.isExpired)

  /**
   * Find all auth codes for a given user.
   */
  def getAuthCodesForUser(user: User): List[AuthCode] =
    MorphiaObject.datastore.createQuery(classOf[AuthCode])
      .filter("userId =", user.id)
      .asList()
      .asScala.toList
      .filterNot(_.isExpired)

  /**
   * Update or create the auth code token for a given client and user.
   */
  private def updateAuthCode(clientId: ObjectId, userId: ObjectId, code: String, redirectUri: String, issued: Date, expires: Long) =
    MorphiaObject.datastore.updateFirst(
      MorphiaObject.datastore.createQuery(classOf[AuthCode])
        .filter("clientId =", clientId)
        .filter("userId =", userId),
      MorphiaObject.datastore.createUpdateOperations[AuthCode](classOf[AuthCode])
        .set("clientId", clientId)
        .set("userId", userId)
        .set("token", code)
        .set("redirectUri", redirectUri)
        .set("issued", issued)
        .set("expires", expires),
      true)

  /**
   *
   */
  def refreshAuthCode(client: Client, user: User, redirectUri: String): Option[AuthCode] = {
    updateAuthCode(client.id, user.id, Crypto.generateToken, redirectUri, new Date(), defaultExpiration)
    findByClient(client, user, redirectUri)
  }

  /**
   * Delete all access tokens associated with a client.
   */
  def deleteAllForClient(client: Client) =
    MorphiaObject.datastore.delete(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId =", client.id))
}