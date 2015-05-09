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
 * A client that can be used to authenicate at most one user.
 */
@Entity
class OneTimeClient(
  id: ObjectId,
  name: String,
  uri: String,
  blurb: String,
  clientSecret: String,
  created: Date,
  var userId: ObjectId) extends Client(id, name, uri, blurb, clientSecret, created, null, "")
{
  def this() = this(null, "", "", "", "", new Date(0), null)

}

object OneTimeClient
{
  private def save[A](obj: A): Option[A] = {
    MorphiaObject.datastore.save[A](obj)
    Some(obj)
  }

  private def clientDb(): Query[OneTimeClient] =
    MorphiaObject.datastore.createQuery((classOf[OneTimeClient]))

  def createClient(name: String, uri: String, blurb: String) =
    save(new OneTimeClient(null, name, Client.normalizeUri(uri), blurb, Crypto.generateToken, new Date(), null))


  def regenerateSecret(client: OneTimeClient): Option[OneTimeClient] = {
    client.clientSecret = Crypto.generateToken
    save(client)
  }

  /**
   * Get a client by its id.
   */
  def findById(id: ObjectId): Option[OneTimeClient] =
    Option(MorphiaObject.datastore.createQuery(classOf[OneTimeClient])
      .filter("id = ", id)
      .get)

  def findById(id: String): Option[OneTimeClient] =
    stringToObjectId(id).flatMap(findById)

  def findByIdAndSecret(id: String, secret: String): Option[OneTimeClient] =
    findById(id) flatMap { client =>
      if (client.clientSecret == secret)
        return Some(client)
      else
        None
    }

  /**
   * Get a client by its id and ensure it is owned by a given user.
   */
  def findByIdForUser(id: ObjectId, user: User): Option[OneTimeClient] =
    Option(MorphiaObject.datastore.createQuery(classOf[OneTimeClient])
      .filter("id = ", id)
      .filter("userId = ", user.id)
      .get)

  def findByIdForUser(id: String, user: User): Option[OneTimeClient] =
    stringToObjectId(id).flatMap(x => findByIdForUser(x, user))


  /**
   * Lookup all clients for a given user.
   */
  def findForUser(user: User): List[OneTimeClient] =
    MorphiaObject.datastore.createQuery(classOf[OneTimeClient])
      .filter("userId = ", user.id)
      .asList()
      .asScala.toList

  /**
   * 
   */
  def setUser(client: OneTimeClient, user: models.User): Option[OneTimeClient] =
    if (client.userId == null) {
      client.userId = user.id
      save(client)
      Some(client)
    } else {
      None
    }

  /**
   *
   */
  def deleteClient(client: OneTimeClient): Unit = {
    MorphiaObject.datastore.delete(
      clientDb()
        .filter("id =", client.id))
    AccessToken.deleteAllForClient(client)
    OneTimeCode.deleteAllForClient(client)
  }

}