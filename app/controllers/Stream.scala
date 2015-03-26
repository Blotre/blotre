package controllers

import Actors.{StreamSupervisor}
import akka.actor._
import akka.contrib.pattern.DistributedPubSubMediator
import be.objectify.deadbolt.java.actions.SubjectPresent
import models.User
import play.api.libs.iteratee.{Concurrent, Iteratee}
import play.api.mvc._
import play.api.libs.json._
import play.api.data._
import play.api.data.Forms._
import play.api.data.validation.Constraints._
import play.api.libs.concurrent.Akka
import play.api.libs.concurrent.Execution.Implicits._
import play.api.Play.current
import scala.collection.immutable._
import helper._
import helper.ImageHelper

/**
 *
 */
object Stream extends Controller {
  case class StatusUpdate(val color: String) { }

  /**
   * Form to update the status of a stream.
   */
  val statusForm = Form(
    mapping(
      "color" -> nonEmptyText.verifying(pattern("""#[0-9a-fA-f]{6}""".r))
    )(StatusUpdate.apply)(StatusUpdate.unapply))

  val AcceptsPng = PrefersExtOrMime("png", "image/png")

  def uriMap(uri: String): Map[String, String] = {
    (uri
      .split('/')
      .foldLeft(("", Map[String, String]())) { (p, c) =>
        (p._1 + "/" + c, p._2 + (c -> (p._1 + "/" + c)))
      })._2
  }

  /**
   * Stream root index page.
   *
   * Displays a list of streams for searching.
   */
  def index = Action { implicit request => JavaContext.withContext {
    val query = request.getQueryString("query").getOrElse("")
    val streams = if (query.isEmpty) models.Stream.findByUpdated() else models.Stream.findByQuery(query)
    request match {
      case Prefers.Json() =>
        Ok(Json.obj(
          "query" -> query,
          "streams" -> streams
        ))
      case _ =>
        Ok(views.html.stream.index.render())
    }
  }}

  /**
   *
   */
  def getStream(uri: String) = Action { implicit request => JavaContext.withContext {
    val path = uri.split('.')(0)
    val s: models.Stream = models.Stream.findByUri(path)
    if (s == null) {
      // TODO: replace with try create page?
      NotFound(views.html.notFound.render(""));
    } else {
      request match {
        case AcceptsPng() => {
          val img = ImageHelper.createImage(s.status.color);
          Ok(ImageHelper.toPng(img))
            .withHeaders(
              "Cache-Control" -> "no-cache, no-store, must-revalidate",
              "Expires" -> "0")
            .as("image/png")
        }
        case Accepts.Html() => {
          val map = uriMap(s.uri)
          Ok(views.html.stream.stream.render(s, children = List(), uriPath = map))
        }
      }
    }
  }}

  /**
   * Update an existing stream.
   */
  @SubjectPresent
  def postStreamUpdate(uri: String) = Action { implicit request => {
    val localUser: User = Application.getLocalUser(request)
    statusForm.bindFromRequest().fold(
      formWithErrors => BadRequest(""),
      userData => {
        updateStreamStatus(uri, userData.color, localUser)
        Ok("")
      })
  }}

  /**
   * Can a user edit a given stream?
   */
  def canUpdateStreamStatus(stream: models.Stream, poster: User): Option[models.Stream] = {
    if (poster != null && stream != null)
      if (stream.ownerId == poster.id)
        return Some(stream);
    return None;
  }

  def canUpdateStreamStatus(uri: String, poster: User): Option[models.Stream] =
    canUpdateStreamStatus(models.Stream.findByUri(uri), poster)

  /**
   *
   */
  private def updateStreamStatus(uri: String, color: String, poster: User) = {
    canUpdateStreamStatus(uri: String, poster)
      .map { _ =>
        models.Stream.updateStreamStatus(uri, color, poster) match {
          case Some(s) =>
            StreamSupervisor.updateStatus(uri, s.status)
          case None =>
        }
      }
  }
}

