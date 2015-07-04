package service


import com.feth.play.module.pa.user.AuthUser
import com.feth.play.module.pa.user.AuthUserIdentity
import com.feth.play.module.pa.service.UserServicePlugin
import models.User
import play.Application
import com.google.inject.Inject

class MyUserServicePlugin @Inject() (app: Application) extends UserServicePlugin(app)
{
	override def save(authUser: AuthUser): AnyRef = {
		val isLinked = User.existsByAuthUserIdentity(authUser)
		if (!isLinked) {
			User.create(authUser).id
		} else {
			null
		}
	}

	override def getLocalIdentity(identity: AuthUserIdentity): AnyRef =
		User.findByAuthUserIdentity(identity).map(_.id).getOrElse(null)

	override def merge(newUser: AuthUser, oldUser: AuthUser): AuthUser = {
		if (oldUser != newUser) {
			User.mergeAuthUsers(oldUser, newUser)
		}
		oldUser
	}

	override def link(oldUser: AuthUser, newUser: AuthUser): AuthUser = {
		User.addLinkedAccount(oldUser, newUser)
		newUser
	}

	override def update(knownUser: AuthUser): AuthUser = {
		User.setLastLoginDate(knownUser)
		knownUser
	}
}

