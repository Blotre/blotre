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
import java.util._
import scala.collection.JavaConversions._


@SerialVersionUID(1L)
@Entity
class User extends Subject {

  @Id
  var id: ObjectId = _

  @Constraints.Email
  var email: String = _

  var name: String = _

  var firstName: String = _

  var lastName: String = _

  @Constraints.Pattern("[a-z]+")
  @Constraints.MinLength(3)
  @Constraints.MaxLength(60)
  var userName: String = _

  @Formats.DateTime(pattern = "yyyy-MM-dd HH:mm:ss")
  var lastLogin: Date = _

  var active: Boolean = _

  var emailValidated: Boolean = _

  var userNameSelected: Boolean = _

  @Embedded
  var roles: List[SecurityRole] = new ArrayList[SecurityRole]()

  @Embedded
  var linkedAccounts: List[LinkedAccount] = new ArrayList[LinkedAccount]()

  @Embedded
  var permissions: List[UserPermission] = new ArrayList[UserPermission]()

  override def getIdentifier(): String = id.toString

  override def getRoles(): List[_ <: Role] = roles

  override def getPermissions(): List[_ <: Permission] = permissions

  def getUserPermissions(): List[UserPermission] = permissions

  def getLinkedAccounts(): List[LinkedAccount] = linkedAccounts

  def merge(otherUser: User) {
    for (acc <- otherUser.linkedAccounts) {
      this.linkedAccounts.add(LinkedAccount.create(acc))
    }
    otherUser.active = false
    MorphiaObject.datastore.save[User](otherUser)
    MorphiaObject.datastore.save[User](this)
  }

  def getProviders(): Set[String] = {
    val providerKeys = new HashSet[String](linkedAccounts.size)
    for (acc <- linkedAccounts) {
      providerKeys.add(acc.providerKey)
    }
    providerKeys
  }

  def getAccountByProvider(providerKey: String): LinkedAccount = {
    LinkedAccount.findByProviderKey(this, providerKey)
  }

  def changePassword(authUser: UsernamePasswordAuthUser, create: Boolean) {
    var a = this.getAccountByProvider(authUser.getProvider)
    if (a == null) {
      if (create) {
        a = LinkedAccount.create(authUser)
      } else {
        throw new RuntimeException("Account not enabled for password usage")
      }
    }
    a.providerUserId = authUser.getHashedPassword
    this.linkedAccounts.add(a)
    MorphiaObject.datastore.save[User](this)
  }

  def getStatus(): Status = {
    if (!this.userNameSelected)
      return new Status()
    val userStream = Stream.findByUri(this.userName)
    userStream.status
  }
}


object User extends models.Serializable {

  private def getDb(): Query[User] = {
    MorphiaObject.datastore.createQuery((classOf[User]))
  }

  def getUsers(): List[User] =
    getDb.filter("active =", true).asList()

  def existsByAuthUserIdentity(identity: AuthUserIdentity): Boolean = {
    var exp: Query[User] = null
    exp = if (identity.isInstanceOf[UsernamePasswordAuthUser]) getUsernamePasswordAuthUserFind(identity.asInstanceOf[UsernamePasswordAuthUser]) else getAuthUserFind(identity)
    exp.countAll() > 0
  }

  def findById(id: ObjectId): User = getDb.filter("id =", id).get();

  private def getAuthUserFind(identity: AuthUserIdentity): Query[User] = {
    getDb.filter("active =", true).filter("linkedAccounts.providerUserId", identity.getId)
      .filter("linkedAccounts.providerKey", identity.getProvider)
  }

  def findByAuthUserIdentity(identity: AuthUserIdentity): User = {
    if (identity == null) {
      return null
    }
    if (identity.isInstanceOf[UsernamePasswordAuthUser]) {
      findByUsernamePasswordIdentity(identity.asInstanceOf[UsernamePasswordAuthUser])
    } else {
      getAuthUserFind(identity).get
    }
  }

  def findByUsernamePasswordIdentity(identity: UsernamePasswordAuthUser): User = {
    getUsernamePasswordAuthUserFind(identity).get
  }

  private def getUsernamePasswordAuthUserFind(identity: UsernamePasswordAuthUser): Query[User] = {
    getEmailUserFind(identity.getEmail).filter("linkedAccounts.providerKey", identity.getProvider)
  }

  def create(authUser: AuthUser): User = {
    val user = new User()
    user.roles = Collections.singletonList(SecurityRole.findByRoleName(controllers.ApplicationConstants.USER_ROLE).get)
    user.active = true
    user.lastLogin = new Date()
    user.linkedAccounts = Collections.singletonList(LinkedAccount.create(authUser))
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

  def mergeAuthUsers(oldUser: AuthUser, newUser: AuthUser) {
    User.findByAuthUserIdentity(oldUser).merge(User.findByAuthUserIdentity(newUser))
  }

  def addLinkedAccount(oldUser: AuthUser, newUser: AuthUser) {
    val u = User.findByAuthUserIdentity(oldUser)
    u.linkedAccounts.add(LinkedAccount.create(newUser))
    MorphiaObject.datastore.save[User](u)
  }

  def setLastLoginDate(knownUser: AuthUser) {
    val u = User.findByAuthUserIdentity(knownUser)
    u.lastLogin = new Date()
    MorphiaObject.datastore.save[User](u)
  }

  def findByEmail(email: String): User =
    getEmailUserFind(email).get

  private def getEmailUserFind(email: String): Query[User] =
    getDb.filter("active", true).filter("email", email)

  def verify(unverified: User) {
    unverified.emailValidated = true
    MorphiaObject.datastore.save[User](unverified)
    TokenAction.deleteByUser(unverified, Type.EMAIL_VERIFICATION)
  }

  def setUserName(currentUser: User, requestedUserName: String) {
    if (currentUser.userNameSelected)
      return
    currentUser.userName = requestedUserName
    currentUser.userNameSelected = true
    MorphiaObject.datastore.save[User](currentUser)
  }

  implicit val userWrites = new Writes[User] {
    def writes(x: User): JsValue = {
      Json.obj(
        "id" -> x.id,
        "userName" -> x.userName,
        "status" -> x.getStatus()
      )
    }
  }
}