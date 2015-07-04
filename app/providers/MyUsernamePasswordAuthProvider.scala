package providers

import com.feth.play.module.mail.Mailer.Mail.Body
import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.providers.password.UsernamePasswordAuthProvider
import com.feth.play.module.pa.providers.password.UsernamePasswordAuthUser
import com.feth.play.module.pa.providers.password.UsernamePasswordAuthProvider._
import controllers.routes
import models.LinkedAccount
import models.TokenAction
import models.TokenAction.Type
import models.User
import play.Application
import play.Logger
import play.data.Form
import play.data.validation.Constraints.Email
import play.data.validation.Constraints.MinLength
import play.data.validation.Constraints.Required
import play.i18n.Lang
import play.i18n.Messages
import play.mvc.Call
import play.mvc.Http.Context
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.util.ArrayList
import java.util.List
import java.util.UUID
import play.data.Form.form
import MyUsernamePasswordAuthProvider._

//remove if not needed

import scala.collection.JavaConversions._
import com.google.inject.Inject

object MyUsernamePasswordAuthProvider
{
  def getProvider(): MyUsernamePasswordAuthProvider = {
    PlayAuthenticate.getProvider(UsernamePasswordAuthProvider.PROVIDER_KEY).asInstanceOf[MyUsernamePasswordAuthProvider]
  }

  class MyIdentity {

    def this(email: String) {
      this()
      this.email = email
    }

    @Required
    @Email
    var email: String = _
  }

  class MyLogin extends MyIdentity with com.feth.play.module.pa.providers.password.UsernamePasswordAuthProvider.UsernamePassword {

    @Required
    @MinLength(5)
    var password: String = _

    override def getEmail(): String = email

    override def getPassword(): String = password
  }

  class MySignup extends MyLogin {

    @Required
    @MinLength(5)
    var repeatPassword: String = _

    @Required
    var name: String = _

    def validate(): String = {
      if (password == null || password != repeatPassword) {
        return Messages.get("playauthenticate.password.signup.error.passwords_not_same")
      }
      null
    }
  }

  val SIGNUP_FORM = form(classOf[MySignup])

  val LOGIN_FORM = form(classOf[MyLogin])

  private def generateToken(): String = UUID.randomUUID().toString
}

class MyUsernamePasswordAuthProvider @Inject() (app: Application) extends
UsernamePasswordAuthProvider[String,
  MyLoginUsernamePasswordAuthUser,
  MyUsernamePasswordAuthUser,
  MyUsernamePasswordAuthProvider.MyLogin,
  MyUsernamePasswordAuthProvider.MySignup](app)
{
  protected def getSignupForm(): Form[MySignup] = SIGNUP_FORM

  protected def getLoginForm(): Form[MyLogin] = LOGIN_FORM

  protected override def signupUser(user: MyUsernamePasswordAuthUser): com.feth.play.module.pa.providers.password.UsernamePasswordAuthProvider.SignupResult = {
    val u = User.findByUsernamePasswordIdentity(user).getOrElse(null)
    if (u != null) {
      if (u.emailValidated) {
        return SignupResult.USER_EXISTS
      } else {
        return SignupResult.USER_EXISTS_UNVERIFIED
      }
    }
    val newUser = User.create(user)
    SignupResult.USER_CREATED_UNVERIFIED
  }

  protected override def loginUser(authUser: MyLoginUsernamePasswordAuthUser): com.feth.play.module.pa.providers.password.UsernamePasswordAuthProvider.LoginResult = {
    val u = User.findByUsernamePasswordIdentity(authUser).getOrElse(null)
    if (u == null) {
      LoginResult.NOT_FOUND
    } else {
      if (!u.emailValidated) {
        LoginResult.USER_UNVERIFIED
      } else {
        for (acc <- u.linkedAccounts if getKey == acc.providerKey) {
          if (authUser.checkPassword(acc.providerUserId, authUser.getPassword)) {
            return LoginResult.USER_LOGGED_IN
          } else {
            return LoginResult.WRONG_PASSWORD
          }
        }
        LoginResult.WRONG_PASSWORD
      }
    }
  }

  protected override def userExists(authUser: UsernamePasswordAuthUser): Call = routes.Signup.exists()

  protected override def userUnverified(authUser: UsernamePasswordAuthUser): Call = routes.Application.index()

  protected override def buildSignupAuthUser(signup: MySignup, ctx: Context): MyUsernamePasswordAuthUser =
    new MyUsernamePasswordAuthUser(signup)

  protected override def buildLoginAuthUser(login: MyLogin, ctx: Context): MyLoginUsernamePasswordAuthUser =
    new MyLoginUsernamePasswordAuthUser(login.getPassword, login.getEmail)

  protected override def transformAuthUser(authUser: MyUsernamePasswordAuthUser, context: Context): MyLoginUsernamePasswordAuthUser =
    new MyLoginUsernamePasswordAuthUser(authUser.getEmail)

  protected override def getVerifyEmailMailingSubject(user: MyUsernamePasswordAuthUser, ctx: Context): String =
    throw new UnsupportedOperationException()

  protected override def onLoginUserNotFound(context: Context): String = {
    context.flash().put(controllers.ApplicationConstants.FLASH_ERROR_KEY, Messages.get("playauthenticate.password.login.unknown_user_or_pw"))
    super.onLoginUserNotFound(context)
  }

  protected override def getVerifyEmailMailingBody(token: String, user: MyUsernamePasswordAuthUser, ctx: Context): Body =
    throw new UnsupportedOperationException()

  protected override def generateVerificationRecord(user: MyUsernamePasswordAuthUser): String =
    throw new UnsupportedOperationException()

}

