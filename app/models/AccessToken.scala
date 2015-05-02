package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import org.mongodb.morphia.query.Query

import scala.annotation.meta.field

@Entity
case class Token(
  @(Id @field)
  id: ObjectId,

  clientId: ObjectId,
  userId: ObjectId,

  token: String,
  redirectUri: String,

  issued: Date,
  expires: Long)
{
  val scope = "rw"

  def this() = this(null, null, null, "", "", new Date(0), 0)

  def isExpired() =
    this.expires < ((new Date().getTime - this.issued.getTime) / 1000)

  def getClient(): Option[Client] =
    Client.findById(this.clientId)

  def getUser(): Option[User] =
    User.findById(this.userId)
}

/**
 *
 */
@Entity
class AccessToken extends Token
{
}

/**
 *
 */
@Entity
class RefreshToken extends Token
{
}


object AccessToken
{
  val defaultExpiration = 60 * 60 * 24 * 3

  /**
   * Update or create the access token for a given client and user.
   */
  def updateAccessToken(clientId: ObjectId, userId: ObjectId, token: String, redirectUri: String, issued: Date, expires: Long) =
    MorphiaObject.datastore.updateFirst(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId = ", clientId)
        .filter("userId = ", userId),
      MorphiaObject.datastore.createUpdateOperations[AccessToken](classOf[AccessToken])
        .set("clientId", clientId)
        .set("userId", userId)
        .set("token", token)
        .set("redirectUri", redirectUri)
        .set("issued", issued)
        .set("expires", expires),
      true)

  /**
   *
   */
  def refreshAccessToken(client: Client, user: User, redirectUri: String): Option[AccessToken] = {
    updateAccessToken(client.id, user.id, Crypto.generateToken, redirectUri, new Date(), defaultExpiration)
    findToken(client.id, user)
  }

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
      .filter("token = ", accessToken)
      .get)

  /**
   *
   */
  def findValidByAccessToken(accessToken: String): Option[AccessToken] =
    findByAccessToken(accessToken) flatMap { token =>
      if (token.isExpired) None else Some(token)
    }

  /**
   * Delete all access tokens associated with a client.
   */
  def deleteAllForClient(client: Client) =
    MorphiaObject.datastore.delete(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId =", client.id))
}