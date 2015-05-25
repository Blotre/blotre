package models

import be.objectify.deadbolt.core.models.Permission
import be.objectify.deadbolt.core.models.Role
import be.objectify.deadbolt.core.models.Subject
import com.feth.play.module.pa.providers.password.UsernamePasswordAuthUser
import com.feth.play.module.pa.user._
import helper.datasources.MorphiaObject
import models.TokenAction.Type
import org.bson.types.ObjectId
import org.mongodb.morphia.annotations.Embedded
import org.mongodb.morphia.annotations.Entity
import org.mongodb.morphia.annotations.Id
import org.mongodb.morphia.query.Query
import play.api.libs.json.{Json, JsValue, Writes}
import play.data.format.Formats
import play.data.validation.Constraints
import java.util.Date
import scala.collection.JavaConverters._


@SerialVersionUID(1L)
@Entity
class User extends Subject
{
  @Id
  var id: ObjectId = _

  @Constraints.Email
  var email: String = _

  var name: String = _

  var firstName: String = _

  var lastName: String = _

  @Constraints.Pattern("[a-z]+")
  @Constraints.MinLength(3)
  @Constraints.MaxLength(64)
  var userName: String = _

  @Formats.DateTime(pattern = "yyyy-MM-dd HH:mm:ss")
  var lastLogin: Date = _

  var active: Boolean = _

  var emailValidated: Boolean = _

  var userNameSelected: Boolean = _

  var rootStreamId: ObjectId = _

  var streamCount: Long = _

  @Embedded
  var roles: java.util.List[SecurityRole] = new java.util.ArrayList[SecurityRole]()

  @Embedded
  var linkedAccounts: java.util.List[LinkedAccount] = new java.util.ArrayList[LinkedAccount]()

  @Embedded
  var permissions: java.util.List[UserPermission] = new java.util.ArrayList[UserPermission]()

  override def getIdentifier(): String = id.toString

  override def getRoles(): java.util.List[_ <: Role] = roles

  override def getPermissions(): java.util.List[_ <: Permission] = permissions

  def getUserPermissions(): java.util.List[UserPermission] = permissions

  def getLinkedAccounts(): java.util.List[LinkedAccount] = linkedAccounts

  def merge(otherUser: User) = {
    this.linkedAccounts.addAll(otherUser.linkedAccounts)
    otherUser.active = false
    MorphiaObject.datastore.save[User](otherUser)
    MorphiaObject.datastore.save[User](this)
  }

  /**
   * Get keys of all provides linked to this user.
   */
  def getProviders(): Set[String] =
    linkedAccounts.asScala.map(_.providerKey).toSet

  def getAccountByProvider(providerKey: String): LinkedAccount =
    LinkedAccount.findByProviderKey(this, providerKey)

  def rootStream(): Option[Stream] =
    Stream.findByUri(this.userName)

  def getStatus(): Status =
    rootStream
      .map(_.status)
      .getOrElse(new Status())
}


object User
{
  import models.Serializable._

  val userNamePattern = (Stream.streamNameCharacter + "{3,64}").r

  val streamLimit = 10000

  implicit val userWrites = new Writes[User] {
    def writes(x: User): JsValue = {
      val rootStreamId = x.rootStream.map(x => x.id).getOrElse(new ObjectId())
      Json.obj(
        "id" -> x.id,
        "userName" -> x.userName,
        "rootStream" -> rootStreamId
      )
    }
  }

  def toValidUsername(name: String): Option[String] = {
    val trimmed = name.trim()
    if (trimmed.matches(userNamePattern.toString))
      Some(trimmed)
    else
      None
  }

  private def getDb(): Query[User] =
    MorphiaObject.datastore.createQuery((classOf[User]))

  def getUsers(): List[User] =
    getDb.filter("active =", true).asList().asScala.toList

  def existsByAuthUserIdentity(identity: AuthUserIdentity): Boolean = {
    var exp: Query[User] = null
    exp = if (identity.isInstanceOf[UsernamePasswordAuthUser]) getUsernamePasswordAuthUserFind(identity.asInstanceOf[UsernamePasswordAuthUser]) else getAuthUserFind(identity)
    exp.countAll() > 0
  }

  /**
   * Lookup a user by id.
   */
  def findById(id: ObjectId): Option[User] =
    Option(getDb
      .filter("id =", id)
      .get())

  def findById(id: String): Option[User] =
    stringToObjectId(id).flatMap(findById)

  private def getAuthUserFind(identity: AuthUserIdentity): Query[User] = {
    getDb.filter("active =", true).filter("linkedAccounts.providerUserId", identity.getId)
      .filter("linkedAccounts.providerKey", identity.getProvider)
  }

  def findByAuthUserIdentity(identity: AuthUserIdentity): Option[User] =
    if (identity == null)
      None
    else {
      if (identity.isInstanceOf[UsernamePasswordAuthUser]) {
        findByUsernamePasswordIdentity(identity.asInstanceOf[UsernamePasswordAuthUser])
      } else {
        Option(getAuthUserFind(identity).get)
      }
    }

  def findByUsernamePasswordIdentity(identity: UsernamePasswordAuthUser): Option[User] =
    Option(getUsernamePasswordAuthUserFind(identity).get)

  private def getUsernamePasswordAuthUserFind(identity: UsernamePasswordAuthUser): Query[User] =
    getEmailUserFind(identity.getEmail).filter("linkedAccounts.providerKey", identity.getProvider)

  def create(authUser: AuthUser): User = {
    val user = new User()
    user.roles = java.util.Collections.singletonList(SecurityRole.findByRoleName(controllers.ApplicationConstants.USER_ROLE))
    user.active = true
    user.lastLogin = new Date()
    user.linkedAccounts = java.util.Collections.singletonList(LinkedAccount.create(authUser))
    if (authUser.isInstanceOf[EmailIdentity]) {
      val identity = authUser.asInstanceOf[EmailIdentity]
      user.email = identity.getEmail
      user.emailValidated = false
    }
    if (authUser.isInstanceOf[NameIdentity]) {
      val identity = authUser.asInstanceOf[NameIdentity]
      val name = identity.getName
      if (name != null) {
        user.name = name
      }
    }
    if (authUser.isInstanceOf[FirstLastNameIdentity]) {
      val identity = authUser.asInstanceOf[FirstLastNameIdentity]
      val firstName = identity.getFirstName
      val lastName = identity.getLastName
      if (firstName != null) {
        user.firstName = firstName
      }
      if (lastName != null) {
        user.lastName = lastName
      }
    }
    MorphiaObject.datastore.save[User](user)
    user
  }

  def mergeAuthUsers(oldUser: AuthUser, newUser: AuthUser) =
    User.findByAuthUserIdentity(oldUser) flatMap { oldUser =>
      User.findByAuthUserIdentity(newUser) map { newUser =>
        oldUser.merge(newUser)
      }
    }

  def addLinkedAccount(oldUser: AuthUser, newUser: AuthUser) =
    User.findByAuthUserIdentity(oldUser) map { u =>
      u.linkedAccounts.add(LinkedAccount.create(newUser))
      MorphiaObject.datastore.save[User](u)
    }

  def setLastLoginDate(knownUser: AuthUser) =
    User.findByAuthUserIdentity(knownUser) map { u =>
      u.lastLogin = new Date()
      MorphiaObject.datastore.save[User](u)
    }

  def findByEmail(email: String): Option[User] =
    Option(getEmailUserFind(email).get)

  private def getEmailUserFind(email: String): Query[User] =
    getDb.filter("active", true).filter("email", email)


  def setUserName(currentUser: User, requestedUserName: String) {
    if (currentUser.userNameSelected)
      return
    currentUser.userName = requestedUserName
    currentUser.userNameSelected = true
    MorphiaObject.datastore.save[User](currentUser)
  }

  def incrementStreamCount(user: User): Unit =
    MorphiaObject.datastore.update(
      getDb().filter("id", user.id),
      MorphiaObject.datastore.createUpdateOperations((classOf[User])).inc("streamCount"))

  def decrementStreamCount(user: User): Unit =
    MorphiaObject.datastore.update(
      getDb().filter("id", user.id),
      MorphiaObject.datastore.createUpdateOperations((classOf[User])).dec("streamCount"))
}