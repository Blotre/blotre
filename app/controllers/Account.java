package controllers;

import be.objectify.deadbolt.java.actions.Group;
import be.objectify.deadbolt.java.actions.Restrict;
import be.objectify.deadbolt.java.actions.SubjectPresent;
import com.feth.play.module.pa.PlayAuthenticate;
import com.feth.play.module.pa.user.AuthUser;
import java.util.LinkedList;
import models.Stream;
import models.User;
import org.mongodb.morphia.Key;
import play.data.Form;
import play.data.format.Formats.NonEmpty;
import play.data.validation.Constraints;
import play.data.validation.Constraints.Required;
import play.i18n.Messages;
import play.libs.Json;
import play.mvc.Controller;
import play.mvc.Result;
import providers.MyUsernamePasswordAuthProvider;
import scala.Option;
import views.html.account.link;
import views.html.account.ask_link;
import views.html.account.ask_merge;

import controllers.routes;

import static play.data.Form.form;

public class Account extends Controller {

	public static class Accept {
		@Required
		@NonEmpty
		public Boolean accept;

		public Boolean getAccept() {
			return accept;
		}

		public void setAccept(Boolean accept) {
			this.accept = accept;
		}
	}

	private static final Form<Accept> ACCEPT_FORM = form(Accept.class);

	@SubjectPresent
	public static Result link() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		return ok(link.render());
	}

	@Restrict(@Group(ApplicationConstants.USER_ROLE))
	public static Result verifyEmail() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		final User user = Application.getLocalUser(session());
		if (user.emailValidated()) {
			flash(ApplicationConstants.FLASH_MESSAGE_KEY,
					Messages.get("playauthenticate.verify_email.error.already_validated"));
		} else if (user.email() != null && !user.email().trim().isEmpty()) {
			flash(ApplicationConstants.FLASH_MESSAGE_KEY, Messages.get(
					"playauthenticate.verify_email.message.instructions_sent",
					user.email()));
            MyUsernamePasswordAuthProvider provider = MyUsernamePasswordAuthProvider.getProvider();
			if (provider != null) {
                provider.sendVerifyEmailMailingAfterSignup(user, ctx());
            }
		} else {
			flash(ApplicationConstants.FLASH_MESSAGE_KEY, Messages.get(
					"playauthenticate.verify_email.error.set_email_first",
					user.email()));
		}
		return redirect(routes.Account.account());
	}

    @Restrict(@Group(ApplicationConstants.USER_ROLE))
    public static Result account() {
        final User localUser = Application.getLocalUser(session());
        return ok(views.html.account.account.render(localUser));
    }

	@SubjectPresent
	public static Result askLink() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		final AuthUser u = PlayAuthenticate.getLinkUser(session());
		if (u == null) {
			// account to link could not be found, silently redirect to login
			return redirect(routes.Application.index());
		}
		return ok(ask_link.render(ACCEPT_FORM, u));
	}

	@SubjectPresent
	public static Result doLink() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		final AuthUser u = PlayAuthenticate.getLinkUser(session());
		if (u == null) {
			// account to link could not be found, silently redirect to login
			return redirect(routes.Application.index());
		}

		final Form<Accept> filledForm = ACCEPT_FORM.bindFromRequest();
		if (filledForm.hasErrors()) {
			// User did not select whether to link or not link
			return badRequest(ask_link.render(filledForm, u));
		} else {
			// User made a choice :)
			final boolean link = filledForm.get().accept;
			if (link) {
				flash(ApplicationConstants.FLASH_MESSAGE_KEY,
						Messages.get("playauthenticate.accounts.link.success"));
			}
			return PlayAuthenticate.link(ctx(), link);
		}
	}

	@SubjectPresent
	public static Result askMerge() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		// this is the currently logged in user
		final AuthUser aUser = PlayAuthenticate.getUser(session());

		// this is the user that was selected for a login
		final AuthUser bUser = PlayAuthenticate.getMergeUser(session());
		if (bUser == null) {
			// user to merge with could not be found, silently redirect to login
			return redirect(routes.Application.index());
		}

		// You could also get the local user object here via
		// User.findByAuthUserIdentity(newUser)
		return ok(ask_merge.render(ACCEPT_FORM, aUser, bUser));
	}

	@SubjectPresent
	public static Result doMerge() {
		com.feth.play.module.pa.controllers.Authenticate.noCache(response());
		// this is the currently logged in user
		final AuthUser aUser = PlayAuthenticate.getUser(session());

		// this is the user that was selected for a login
		final AuthUser bUser = PlayAuthenticate.getMergeUser(session());
		if (bUser == null) {
			// user to merge with could not be found, silently redirect to login
			return redirect(routes.Application.index());
		}

		final Form<Accept> filledForm = ACCEPT_FORM.bindFromRequest();
		if (filledForm.hasErrors()) {
			// User did not select whether to merge or not merge
			return badRequest(ask_merge.render(filledForm, aUser, bUser));
		} else {
			// User made a choice :)
			final boolean merge = filledForm.get().accept;
			if (merge) {
				flash(ApplicationConstants.FLASH_MESSAGE_KEY,
						Messages.get("playauthenticate.accounts.merge.success"));
			}
			return PlayAuthenticate.merge(ctx(), merge);
		}
	}

    public static class UserNameSelect {
        @Required
        @Constraints.Pattern(value = "[a-z0-9\\-_$]+", message = "User name may only contain letters and numbers")
        @Constraints.MinLength(3)
        @Constraints.MaxLength(100)
        public String userName;
    }

    private static final Form<UserNameSelect> SELECT_USER_NAME_FORM = form(UserNameSelect.class);

    @SubjectPresent
    public static Result selectUserName() {
        final User localUser = Application.getLocalUser(session());

        // Only allow setting user name once
        if (localUser.userNameSelected())
            return redirect(routes.Application.index());

        return ok(views.html.account.selectUserName.render(SELECT_USER_NAME_FORM));
    }

    @SubjectPresent
    public static Result setSelectedUserName() {
        final User localUser = Application.getLocalUser(session());

        // Only allow setting user name once
        if (localUser.userNameSelected())
            return redirect(routes.Application.index());

        Form<UserNameSelect> formData = Form.form(UserNameSelect.class).bindFromRequest();
        if (formData.hasErrors()) {
            flash("error", "Please correct errors.");
            return badRequest(views.html.account.selectUserName.render(formData));
        }
        String requestedUserName = formData.get().userName;
        Option<Stream> existing = Stream.findByUri(requestedUserName);
        if (existing.isDefined()) {
            flash("error", "User name already taken.");
            return badRequest(views.html.account.selectUserName.render(formData));
        }

        Option<Stream> rootStream = Stream.createRootStream(requestedUserName, localUser);
		if (rootStream.isEmpty()) {
			flash("error", "Selected user name could not be processed.");
			return badRequest(views.html.account.selectUserName.render(formData));
		} else {
			User.setUserName(localUser, requestedUserName);
			return redirect(routes.Application.index());
		}
    }
}
