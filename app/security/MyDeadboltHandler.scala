package security

import models.User
import play.libs.F
import play.mvc.Http
import play.mvc.Result
import play.mvc._
import be.objectify.deadbolt.java.AbstractDeadboltHandler
import be.objectify.deadbolt.java.DynamicResourceHandler
import be.objectify.deadbolt.core.models.Subject
import com.feth.play.module.pa.PlayAuthenticate
import com.feth.play.module.pa.user.AuthUserIdentity


class MyDeadboltHandler extends AbstractDeadboltHandler {

	override def beforeAuthCheck(context: Http.Context): F.Promise[Result] = {
		if (PlayAuthenticate.isLoggedIn(context.session())) {
			F.Promise.pure(null)
		} else {
			val originalUrl = PlayAuthenticate.storeOriginalUrl(context)
			context.flash().put("error", "You need to log in first, to view '" + originalUrl +
					"'")

			F.Promise.pure(Results.redirect(PlayAuthenticate.getResolver.login()))
		}
	}

	override def getSubject(context: Http.Context): Subject = {
		val u = PlayAuthenticate.getUser(context)
		User.findByAuthUserIdentity(u).getOrElse(null)
	}

	override def getDynamicResourceHandler(context: Http.Context): DynamicResourceHandler = null

	override def onAuthFailure(context: Http.Context, content: String): F.Promise[Result] =
		F.Promise.pure(Results.forbidden("Forbidden"))
}

