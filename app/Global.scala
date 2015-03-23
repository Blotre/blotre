import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.PlayAuthenticate.Resolver
import com.feth.play.module.pa.exceptions.AccessDeniedException
import com.feth.play.module.pa.exceptions.AuthException
import controllers.routes
import helper.datasources.MongoDB
import helper.datasources.MorphiaObject
import models.SecurityRole
import play.Logger
import play.libs.F._
import play.api._
import play.api.mvc._
import play.api.mvc.Results._
import play.filters.csrf._
import scala.concurrent.Future

object Global extends WithFilters(CSRFFilter()) with GlobalSettings {
    override def onHandlerNotFound(request: RequestHeader) =
      Future.successful(NotFound(views.html.notFound.render(request.uri)))

    override def onStart(app: Application) {
        Logger.info("Application started!")
        setupDatabase()

        PlayAuthenticate.setResolver(new Resolver() {

            override def login(): Call = return routes.Application.login()

            override def afterAuth(): Call = return routes.Application.onLogin()

            override def afterLogout(): Call = return routes.Application.index()

            override def auth(provider: String): Call = {
                return com.feth.play.module.pa.controllers.routes.Authenticate
                        .authenticate(provider)
            }

            override def askMerge(): Call =
              routes.Account.askMerge()

            override def askLink(): Call =
              routes.Account.askLink()

            override def onException(e: AuthException): play.mvc.Call = {
                if (e.isInstanceOf[AccessDeniedException]) {
                    return routes.Signup.oAuthDenied(e.asInstanceOf[AccessDeniedException].getProviderKey)
                }
                return super.onException(e);
            }
        })
        initialData()
    }

    override def onStop(app: Application) {
        Logger.info("Appplication stopped!")
        MongoDB.disconnect()
    }

  private def setupDatabase(): Unit = {
    scalikejdbc.config.DBs.setupAll()
    models.DBInitializer.run()
    Logger.info("Connected to Database!")
  }

    private def initialData() = scalikejdbc.DB localTx { implicit session =>
        if (SecurityRole.allRoles.isEmpty) {
            for (roleName <- List(controllers.ApplicationConstants.USER_ROLE)) {
              new SecurityRole(0, roleName).save()
            }
        }
    }
}

