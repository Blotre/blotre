package models

import java.util.Date

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.Entity

/**
 * Code generated for a one-time-use client that a user can redeem independently to authorize the client app.
 */
@Entity
class OneTimeCode(
  id: ObjectId,

  clientId: ObjectId,

  token: String,

  issued: Date,
  _expires: Long) extends Token(id, clientId, null, token, "", issued, _expires)
{
  def this() = this(null, null, "", new Date(0), 0)

  def expire() = {
    this.expires = 0
    MorphiaObject.datastore.save[OneTimeCode](this)
  }
}

object OneTimeCode
{
  val defaultExpiration = 60L * 20L

  /**
   * Lookup a one time code for a given client
   */
  private def findByClient(client: OneTimeClient): Option[OneTimeCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[OneTimeCode])
      .filter("clientId =", client.id)
      .get)

  /**
   * Lookup an existing, possibly expired code by value.
   */
  def findAllByCode(code: String): Option[OneTimeCode] =
    Option(MorphiaObject.datastore.createQuery(classOf[OneTimeCode])
      .filter("token =", code)
      .get)

  /**
   * Lookup an existing, non expired code by value.
   */
  def findByCode(code: String): Option[OneTimeCode] =
    findAllByCode(code).filterNot(_.isExpired)

  /**
   * Generate a new one time code
   */
  def generateOneTimeCode(client: OneTimeClient): Option[OneTimeCode] = {
    MorphiaObject.datastore.updateFirst(
      MorphiaObject.datastore.createQuery(classOf[OneTimeCode])
        .filter("clientId =", client.id),
      MorphiaObject.datastore.createUpdateOperations[OneTimeCode](classOf[OneTimeCode])
        .set("token", Crypto.generateCode(8))
        .set("issued", new Date())
        .set("expires", defaultExpiration),
      true)
    findByClient(client)
  }

  /**
   * Delete all codes associated with a client.
   */
  def deleteAllForClient(client: OneTimeClient) =
    MorphiaObject.datastore.delete(
      MorphiaObject.datastore.createQuery(classOf[OneTimeCode])
        .filter("clientId =", client.id))
}