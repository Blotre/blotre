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
  @(Id @field) var id: ObjectId,
  name: String,
  var uri: String,
  var blurb: String,
  var clientSecret: String,
  created: Date,
  ownerId: ObjectId,
  var redirects: String)
{
  def this() = this(null, "", "", "", "", new Date(0), null, "")

  def validateCreds(secret: String) =
    this.clientSecret == secret
}

object Client {

  import Serializable._

  val maxClientCount = 10

  val maxRedirects = 10

  var validUrlCharacters = """a-zA-Z0-9\-_\.~!\*'();:@&=\+$,/\?%#\[\]?"""

  def isValidUrl(uri: String) =
    uri.matches("(http://|https://)[" + validUrlCharacters + "]{3,255}")

  private def save[A](obj: A): Option[A] = {
    MorphiaObject.datastore.save[A](obj)
    Some(obj)
  }

  private def clientDb(): Query[Client] =
    MorphiaObject.datastore.createQuery((classOf[Client]))

  def normalizeUri(uri: String) =
    uri.replace("[^" + validUrlCharacters + "]", "+").trim.stripSuffix("/")

  def createClient(name: String, uri: String, blurb: String, owner: User) =
    save(new Client(null, name, normalizeUri(uri), blurb, Crypto.generateToken, new Date(), owner.id, ""))

  def setRedirects(client: Client, redirects: Array[String]) = {
    client.redirects = redirects.take(maxRedirects).map(normalizeUri(_)).mkString("\n")
    save(client)
  }

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

  def findByIdAndSecret(id: String, secret: String): Option[Client] =
    findById(id) flatMap { client =>
      if (client.clientSecret == secret)
        return Some(client)
      else
        None
    }

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
   * Ensures that a redirect belongs to a client.
   */
  def validateRedirect(client: Client, redirectUri: String): Option[Client] =
    if (findRedirectsForClient(client) contains redirectUri)
      Some(client)
    else
      None

  /**
   * Get all the redirects that belong to a client.
   */
  def findRedirectsForClient(client: Client): Array[String] =
    client.redirects.split("\n")

  /**
   * Lookup all clients for a given user.
   */
  def findForUser(user: User): List[Client] =
    MorphiaObject.datastore.createQuery(classOf[Client])
      .filter("ownerId = ", user.id)
      .asList()
      .asScala.toList

  /**
   *
   */
  def deleteClient(client: Client): Unit = {
    MorphiaObject.datastore.delete(
      clientDb()
        .filter("id =", client.id))
    AccessToken.deleteAllForClient(client)
    AuthCode.deleteAllForClient(client)
  }
}

object Crypto
{
  def generateToken: String = {
    val key = java.util.UUID.randomUUID.toString
    new sun.misc.BASE64Encoder().encode(key.getBytes)
  }

  def generateCode(length: Int): String =
    (scala.util.Random.alphanumeric take length).mkString
}
