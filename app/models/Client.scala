package models

import helper.datasources.MorphiaObject
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations._
import org.mongodb.morphia.query.Query
import play.data.validation.Constraints
import java.util.Date
import scala.annotation.meta.field
import scala.collection.JavaConverters._

/**
 *
 */
@Entity
@SerialVersionUID(1)
case class Client(
  @(Id @field)
  var id: ObjectId,

  @Constraints.Required
  @Constraints.MaxLength(255)
  @Constraints.MinLength(3)
  var name: String,

  @Constraints.Required
  @Constraints.MaxLength(255)
  @Constraints.MinLength(3)
  var uri: String,

  @Constraints.Required
  @Constraints.MaxLength(255)
  @Constraints.MinLength(3)
  var blurb: String,

  var clientSecret: String,

  var created: Date,

  var ownerId: ObjectId)
{
  def this() = this(null, "", "", "", "", new Date(0), null)
}

/**
 *
 */
@Entity
@Indexes(Array(new Index(value = "clientId, uri", unique=true)))
@SerialVersionUID(1)
case class ClientRedirectUri(
  @(Id @field)
  var id: ObjectId,

  var clientId: ObjectId,

  @Constraints.Required
  @Constraints.MaxLength(255)
  @Constraints.MinLength(3)
  var uri: String,

  var created: Date)
{
  def this() = this(null, null, "", new Date(0))
}


object Client
{
  import Serializable._

  private def save[A](obj: A): Option[A] = {
    MorphiaObject.datastore.save[A](obj)
    Some(obj)
  }

  private def clientDb(): Query[Client] =
    MorphiaObject.datastore.createQuery((classOf[Client]))

  private def redirectDb(): Query[ClientRedirectUri] =
    MorphiaObject.datastore.createQuery((classOf[ClientRedirectUri]))

  def normalizeUri(uri: String) =
    uri.trim.stripSuffix("/")

  def createClient(name: String, uri: String, blurb: String, owner: User) =
    save(new Client(null, name, normalizeUri(uri), blurb, Crypto.generateToken, new Date(), owner.id))

  def addRedirectUri(client: Client, uri: String, owner: User) =
    save(new ClientRedirectUri(null, client.id, normalizeUri(uri), new Date()))

  def validate(clientId: String, clientSecret: String): Boolean =
    (clientDb()
      .filter("clientId =", clientId)
      .filter("clientSecret =", clientSecret)
      .get != null)

  def regenerateSecret(client: Client): Option[Client] = {
    client.clientSecret = Crypto.generateToken
    save(client)
  }

  /**
   * Get a client by its id.
   */
  def findById(id: ObjectId): Option[Client] =
    Option(MorphiaObject.datastore.createQuery(classOf[Client])
      .filter("id = ", id)
      .get)

  def findById(id: String): Option[Client] =
    stringToObjectId(id).flatMap(findById)

  /**
   * Get a client by its id and ensure it is owned by a given user.
   */
  def findByIdForUser(id: ObjectId, user: User): Option[Client] =
    Option(MorphiaObject.datastore.createQuery(classOf[Client])
      .filter("id = ", id)
      .filter("ownerId = ", user.id)
      .get)

  def findByIdForUser(id: String, user: User): Option[Client] =
    stringToObjectId(id).flatMap(x => findByIdForUser(x, user))

  /**
   * Ensures that a redirect belongs to a client
   */
  def validateRedirect(client: Client, redirectUri: String): Option[Client] =
    Option(MorphiaObject.datastore.createQuery(classOf[ClientRedirectUri])
      .filter("clientId =", client.id)
      .filter("uri =", normalizeUri(redirectUri))
      .get) map { _ =>
        client
      }

  /**
   * Get all the redirects that belong to a client.
   */
  def findRedirectsForClient(client: Client): List[ClientRedirectUri] =
    MorphiaObject.datastore.createQuery(classOf[ClientRedirectUri])
      .filter("clientId =", client.id)
      .asList()
      .asScala.toList

  /**
   * Lookup all clients for a given user.
   */
  def findForUser(user: User): List[Client] =
    MorphiaObject.datastore.createQuery(classOf[Client])
      .filter("ownerId = ", user.id)
      .asList()
      .asScala.toList
}

object Crypto
{
  def generateToken: String = {
    val key = java.util.UUID.randomUUID.toString
    new sun.misc.BASE64Encoder().encode(key.getBytes)
  }
}