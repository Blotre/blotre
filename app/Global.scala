import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.PlayAuthenticate.Resolver
import com.feth.play.module.pa.exceptions.AccessDeniedException
import com.feth.play.module.pa.exceptions.AuthException
import com.typesafe.config.ConfigFactory
import controllers.{JavaContext, routes}
import helper.datasources.MongoDB
import helper.datasources.MorphiaObject
import models.SecurityRole
import play.Logger
import play.api._
import play.api.mvc._
import play.api.mvc.Results._
import play.filters.csrf._
import scala.concurrent.Future
import java.io.File

object Global extends /*WithFilters(CSRFFilter()) with*/ GlobalSettings {
    /**
     * Load environment specific config.
     */
    override def onLoadConfig(config: Configuration, path: File, classLoader: ClassLoader, mode: Mode.Mode): Configuration = {
        val localConfig = Configuration(ConfigFactory.load(s"application.${mode.toString.toLowerCase}.conf"))
        super.onLoadConfig(config ++ localConfig, path, classLoader, mode)
    }

    override def onHandlerNotFound(request: RequestHeader) = {
        implicit val h = request
        JavaContext.withContext {
            Future.successful(NotFound(views.html.notFound.render(request.uri)))
        }
    }

    override def onStart(app: Application) {
        Logger.info("Application started!")
        MongoDB.connect()
        Logger.info("Connected to Database!")
        PlayAuthenticate.setResolver(new Resolver() {

            override def login(): Call = return routes.Application.login()

            override def afterAuth(): Call = return routes.Application.onLogin()

            override def afterLogout(): Call = return routes.Application.index()

            override def auth(provider: String): Call = {
                return com.feth.play.module.pa.controllers.routes.Authenticate
                        .authenticate(provider)
            }

            override def askMerge(): play.mvc.Call =
              routes.Account.askMerge()

            override def askLink(): play.mvc.Call =
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

    private def initialData() {
        if (MorphiaObject.datastore.createQuery(classOf[SecurityRole]).countAll() == 0) {
            for (roleName <- List(controllers.ApplicationConstants.USER_ROLE)) {
                val role = new SecurityRole()
                role.roleName = roleName
                MorphiaObject.datastore.save[SecurityRole](role)
            }
        }
    }
}

