package models

import java.util.Date

import helper.datasources.MorphiaObject
import models.Serializable._
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.{Id, Entity}
import org.mongodb.morphia.query.Query

import scala.annotation.meta.field
import scala.collection.JavaConverters._

/**
 * Base class for token/code type objects.
 */
@Entity
case class Token(
  @(Id @field)
  id: ObjectId,

  clientId: ObjectId,
  userId: ObjectId,

  token: String,
  redirectUri: String,

  issued: Date,
  var expires: Long)
{
  def this() = this(null, null, null, "", "", new Date(0), 0)

  def isExpired() =
    this.expires < ((new Date().getTime - this.issued.getTime) / 1000)

  def getClient(): Option[Client] =
    Client.findById(this.clientId)

  def getUser(): Option[User] =
    User.findById(this.userId)
}

/**
 * Access and refresh token issued for client and user.
 *
 * Only one access token per client, user pair may exist.
 */
@Entity
class AccessToken(
  id: ObjectId,

  clientId: ObjectId,
  userId: ObjectId,

  token: String,
  redirectUri: String,

  issued: Date,
  _expires: Long,

  val refreshToken: String,
  val refreshTokenIssued: Date,
  var refreshTokenExpires: Long) extends Token(id, clientId, userId, token, redirectUri, issued, _expires)
{
  def this() = this(null, null, null, "", "", new Date(0), 0, "", new Date(0), 0)

  def expire() = {
    this.expires = 0
    this.refreshTokenExpires = 0
    MorphiaObject.datastore.save[AccessToken](this)
  }
}

object AccessToken
{
  /**
   * Default expiration time of an access token.
   */
  val defaultExpiration = 60 * 60 * 24 * 3

  /**
   * Default expiration time of an refresh token.
   */
  val defaultRefreshExpiration = 60 * 60 * 24 * 14

  /**
   * Update or create the access token for a client, user pair.
   *
   * Only one access token may exist per client, user pair.
   */
  private def updateAccessToken(
    clientId: ObjectId,
    userId: ObjectId,
    token: String,
    redirectUri: String,
    issued: Date,
    expires: Long,
    refreshToken: String,
    refreshTokenIssued: Date,
    refreshTokenExpires: Long)
  =
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
        .set("expires", expires)
        .set("refreshToken", refreshToken)
        .set("refreshTokenIssued", refreshTokenIssued)
        .set("refreshTokenExpires", refreshTokenExpires),
      true)

  /**
   * Update or create the access token for client, user pair.
   */
  def refreshAccessToken(client: Client, user: User, redirectUri: String): Option[AccessToken] = {
    val issued = new Date()
    updateAccessToken(client.id, user.id, Crypto.generateToken, redirectUri, issued, defaultExpiration, Crypto.generateToken, issued, defaultRefreshExpiration)
    findToken(client.id, user)
  }

  /**
   * Lookup any token for a given client and user.
   *
   * May be expired
   */
  private def findAnyToken(clientId: ObjectId, user: User): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("clientId =", clientId)
      .filter("userId =", user.id)
      .get)

  /**
   * Lookup the valid token for a given client and user.
   */
  def findToken(clientId: ObjectId, user: User): Option[AccessToken] =
    findAnyToken(clientId, user) flatMap { token =>
      if (token.isExpired)
        None
      else
        Some(token)
    }

  def findToken(clientId: String, user: User): Option[AccessToken] =
    stringToObjectId(clientId).flatMap(findToken(_, user))

  /**
   * Lookup an access token by token value.
   *
   * Includes expired tokens.
   */
  private def findAnyByAccessToken(accessToken: String): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("token =", accessToken)
      .get)

  /**
   * Lookup an access token by token value.
   *
   * Only returns valid tokens.
   */
  def findByAccessToken(accessToken: String): Option[AccessToken] =
    findAnyByAccessToken(accessToken) flatMap { token =>
      if (token.isExpired)
        None
      else
        Some(token)
    }

  /**
   * Delete all access tokens associated with a client.
   */
  def deleteAllForClient(client: Client) =
    MorphiaObject.datastore.delete(
      MorphiaObject.datastore.createQuery(classOf[AccessToken])
        .filter("clientId =", client.id))

  /**
   * Get all access tokens for a given user
   */
  private def findAllForUser(user: User): Seq[AccessToken] =
    MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("userId = ", user.id)
      .asList()
      .asScala.toList

  /**
   * Get all valid access tokens for a given user.
   */
  def findForUser(user: User): Seq[AccessToken] =
    findAllForUser(user) filter { token => !token.isExpired() }
}