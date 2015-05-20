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

  def expiresIn(): Long =
    Math.max(0, expires - ((new Date().getTime - issued.getTime) / 1000))

  def isExpired() =
    Token.isExpired(this.issued, this.expires)

  def getClient(): Option[Client] =
    Client.findById(this.clientId)

  def getUser(): Option[User] =
    if (isExpired())
      None
    else
      User.findById(this.userId)
}

object Token
{
  /**
   * Check if a token has expired based on the current time.
   */
  def isExpired(issued: Date, expiration: Long) =
    expiration < ((new Date().getTime - issued.getTime) / 1000)
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

  def isRefreshTokenExpired() =
    Token.isExpired(this.refreshTokenIssued, this.refreshTokenExpires)
}

object AccessToken
{
  /**
   * Default expiration time of an access token.
   */
  private val defaultExpiration = 60 * 60 * 24 * 3

  /**
   * Default expiration time of an refresh token.
   */
  private val defaultRefreshExpiration = 60 * 60 * 24 * 14

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
  def refreshAccessToken(clientId: ObjectId, userId: ObjectId, redirectUri: String): Option[AccessToken] = {
    val issued = new Date()
    updateAccessToken(clientId, userId, Crypto.generateToken, redirectUri, issued, defaultExpiration, Crypto.generateToken, issued, defaultRefreshExpiration)
    findToken(clientId, userId)
  }

  def refreshAccessToken(client: Client, user: User, redirectUri: String): Option[AccessToken] =
    refreshAccessToken(client.id, user.id, redirectUri)

  def refreshAccessToken(existing: AccessToken): Option[AccessToken] =
    refreshAccessToken(existing.clientId, existing.userId, existing.redirectUri)

  /**
   * Lookup any token for a given client and user.
   *
   * May be expired.
   */
  private def findAnyToken(clientId: ObjectId, userId: ObjectId): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("clientId =", clientId)
      .filter("userId =", userId)
      .get)

  /**
   * Lookup the valid token for a given client and user.
   */
  def findToken(clientId: ObjectId, userId: ObjectId): Option[AccessToken] =
    findAnyToken(clientId, userId).filterNot(_.isExpired)

  def findToken(clientId: ObjectId, user: User): Option[AccessToken] =
    findToken(clientId, user.id)

  def findToken(clientId: String, user: User): Option[AccessToken] =
    stringToObjectId(clientId).flatMap(findToken(_, user))

  /**
   * Lookup an access token by token value.
   *
   * Includes expired tokens.
   */
  def findAnyByAccessToken(accessToken: String): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("token =", accessToken)
      .get)

  /**
   * Lookup an access token by token value.
   *
   * Only returns valid tokens.
   */
  def findByAccessToken(accessToken: String): Option[AccessToken] =
    findAnyByAccessToken(accessToken).filterNot(_.isExpired)

  /**
   * Lookup an access token by refresh token value.
   *
   * Includes expired tokens.
   */
  private def findAnyByRefreshToken(refreshToken: String): Option[AccessToken] =
    Option(MorphiaObject.datastore.createQuery(classOf[AccessToken])
      .filter("refreshToken =", refreshToken)
      .get)

  /**
   * Lookup an access token by refresh token value.
   *
   * Only returns valid tokens.
   */
  def findByRefreshToken(refreshToken: String): Option[AccessToken] =
    findAnyByRefreshToken(refreshToken).filterNot(_.isRefreshTokenExpired())

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
    findAllForUser(user).filterNot(_.isExpired)
}