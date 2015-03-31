package oauth

import models.User
import scalaoauth2.provider.{AuthorizationHandler, DataHandler, AuthInfo, ClientCredential}
import scala.concurrent.{Future, ExecutionContext}
import java.util.Date
import org.bson.types.ObjectId

class MyDataHandler extends DataHandler[User]
{
  private def getClientId(authInfo: AuthInfo[User]): Option[ObjectId] =
    authInfo.clientId.flatMap(models.Serializable.stringToObjectId)

  override def findUser(email: String, password: String): Future[Option[User]] =
    Future.successful(User.findByEmail(email))

  override def validateClient(clientCredential: ClientCredential, grantType: String): Future[Boolean] =
    Future.successful(clientCredential.clientSecret
      .map(clientSecret =>
        models.Client.validate(clientCredential.clientId, clientSecret))
      .getOrElse(false))

  override def createAccessToken(authInfo: AuthInfo[User]): Future[scalaoauth2.provider.AccessToken] = {
    val accessTokenExpiresIn = 60L * 60L // 1 hour
    val refreshToken = Crypto.generateToken
    val accessToken = Crypto.generateToken
    val now = new Date()
    getClientId(authInfo).map({ clientId =>
      models.AccessToken.updateAccessToken(authInfo.user.id, clientId, accessToken, refreshToken, now, accessTokenExpiresIn)
      Future.successful(scalaoauth2.provider.AccessToken(accessToken, Some(refreshToken), authInfo.scope, Some(accessTokenExpiresIn), now))
    }).getOrElse(Future.failed(new UninitializedError()))
  }

  override def findClientUser(clientCredential: ClientCredential, scope: Option[String]): Future[Option[User]] =
    Future.successful(None)


  override def getStoredAccessToken(authInfo: AuthInfo[User]): Future[Option[scalaoauth2.provider.AccessToken]] =
    Future.successful(getClientId(authInfo) flatMap { clientId =>
      models.AccessToken.findToken(clientId, authInfo.user.id)
    } map { token =>
      token.toScalaOauth2AccessToken()
    })

  override def refreshAccessToken(authInfo: AuthInfo[User], refreshToken: String): Future[scalaoauth2.provider.AccessToken] =
    createAccessToken(authInfo)

  override def findAccessToken(token: String): Future[Option[scalaoauth2.provider.AccessToken]] =
    Future.successful(models.AccessToken.findByAccessToken(token) map { token =>
      token.toScalaOauth2AccessToken()
    })

  override def findAuthInfoByAccessToken(accessToken: scalaoauth2.provider.AccessToken): Future[Option[AuthInfo[User]]] =
    Future.successful(models.AccessToken.findByAccessToken(accessToken.token) flatMap { token =>
      models.User.findById(token.userId) map { user =>
        AuthInfo(user, Some(token.clientId.toString), Some(token.scope), Some(""/*redirecturi*/))
      }
    })

  override def findAuthInfoByRefreshToken(refreshToken: String): Future[Option[AuthInfo[User]]] =
    Future.successful(models.AccessToken.findByRefreshToken(refreshToken) flatMap { token =>
      models.User.findById(token.userId) map { user =>
        AuthInfo(user, Some(token.clientId.toString), Some(token.scope), Some(""/*redirecturi*/))
      }
    })

  override def findAuthInfoByCode(code: String): Future[Option[AuthInfo[User]]] =
    Future.successful(models.AuthCode.findByCode(code) flatMap { code =>
      models.User.findById(code.userId) map { user =>
        AuthInfo(user, Some(code.clientId.toString), Some(code.scope), Some(code.redirectUri))
      }
    })
}


object Crypto
{
  def generateToken: String = {
    val key = java.util.UUID.randomUUID.toString
    new sun.misc.BASE64Encoder().encode(key.getBytes)
  }
}
