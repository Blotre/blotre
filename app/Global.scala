import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.PlayAuthenticate.Resolver
import com.feth.play.module.pa.exceptions.AccessDeniedException
import com.feth.play.module.pa.exceptions.AuthException
import play.Application
import play.ApplicationLoader
import play.Configuration
import play.{Mode};
import play.inject.guice.GuiceApplicationBuilder
import play.inject.guice.GuiceApplicationLoader
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

class ExcludingCSRFFilter(filter: CSRFFilter) extends EssentialFilter {

    override def apply(nextFilter: EssentialAction) = new EssentialAction {

        import play.api.mvc._

        override def apply(rh: RequestHeader) = {
            val chainedFilter = filter.apply(nextFilter)
            if (rh.tags.getOrElse("ROUTE_COMMENTS", "").contains("NOCSRF")) {
                nextFilter(rh)
            } else {
                chainedFilter(rh)
            }
        }
    }
}

class CustomApplicationLoader extends GuiceApplicationLoader {
    override def builder(context: ApplicationLoader.Context): GuiceApplicationBuilder = {
        val extra = new Configuration(loadConfig(context.environment.mode))
        initialBuilder
            .in(context.environment)
            .loadConfig(extra.withFallback(context.initialConfiguration()))
            .overrides(overrides(context): _*)
    }

    def loadConfig(mode: Mode) = {
        val extraConfFile = s"application.${mode.toString.toLowerCase}.conf"
        val confFileName = if (getClass.getResource(extraConfFile) != null) extraConfFile else "application.conf"
        ConfigFactory.load(confFileName)
    }
}


object Global extends WithFilters(new ExcludingCSRFFilter(CSRFFilter())) with GlobalSettings {
    override def onHandlerNotFound(request: RequestHeader) = {
        implicit val h = request
        Future.successful(NotFound(views.html.notFound.render(h)))
    }

    override def onStart(app: play.api.Application): Unit = {
        Logger.info("Application started!")
        MongoDB.connect()
        Logger.info("Connected to Database!")
        PlayAuthenticate.setResolver(new Resolver() {

            override def login(): Call = routes.Application.login()

            override def afterAuth(): Call = routes.Application.onLogin()

            override def afterLogout(): Call = routes.Application.index()

            override def auth(provider: String): Call =
                com.feth.play.module.pa.controllers.routes.Authenticate
                        .authenticate(provider)

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

    override def onStop(app: play.api.Application): Unit = {
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

