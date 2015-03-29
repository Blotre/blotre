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
object Stream extends Controller
{
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
   * Lookup a stream.
   *
   * Supports:
   *     png - Render 1x1 image of the current status.
   *
   *     html - View of the stream.
   *
   *     json: Returns json of the stream.
   */
  def getStream(uri: String) = Action { implicit request => JavaContext.withContext {
    val path = uri.split('.')(0)
    request match {
      case AcceptsPng() =>
        renderStreamStatusPng(path, request)

      case Prefers.Json() =>
        renderStreamJson(path, request)

      case Accepts.Html() =>
        renderStream(path, request)

      case _ =>
        BadRequest
    }
  }}

  /**
   * Render a stream as html.
   *
   * Displays a try create page if the stream does not exist but the parent does.
   */
  def renderStream(uri: String, request: Request[AnyContent]) =
    models.Stream.findByUri(uri) match {
      case Some(s) =>
        val map = uriMap(s.uri)
        Ok(views.html.stream.stream.render(s, s.getChildren(), uriPath = map))

      case _ =>
        tryCreateDecendant(uri, request)
    }

  /**
   * Render a stream as Json.
   */
  def renderStreamJson(uri: String, request: Request[AnyContent]): Result =
    models.Stream.findByUri(uri)
      .map(s =>
        renderStreamJson(s, request))
      .getOrElse(NotFound)


  def renderStreamJson(stream: models.Stream, request: Request[AnyContent]): Result =
    Ok(Json.toJson(stream))

  /**
   * Render a stream's current status as a 1x1 PNG image.
   */
  def renderStreamStatusPng(uri: String, request: Request[AnyContent]) =
    models.Stream.findByUri(uri)
      .map(s => {
        val img = ImageHelper.createImage(s.status.color)
        Ok(ImageHelper.toPng(img))
          .withHeaders(
            "Cache-Control" -> "no-cache, no-store, must-revalidate",
            "Expires" -> "0")
          .as("image/png")
      })
      .getOrElse(NotFound)


  /**
   * Checks if child stream can created and displays an create page.
   *
   * A child stream can only be created if its direct parent exists and
   * is owned by the current user.
   */
  def tryCreateDecendant(uri: String, request: Request[AnyContent]) = {
    val user = Application.getLocalUser(request)
    getParentPath(uri) match {
      case Some((parent, child)) =>
        models.Stream.findByUri(parent)
          .flatMap({ stream =>
            models.Stream.asEditable(user, stream)
          })
          .map(stream =>
            Ok(views.html.stream.createChild.render(stream, child)))
          .getOrElse(
            NotFound(views.html.notFound.render("")))

      case _ =>
        NotFound(views.html.notFound.render(""))
    }
  }

  /**
   * Perform the stream update operation.
   */
  @SubjectPresent
  def createChildStream(uri: String) = Action { implicit request =>
    val user = Application.getLocalUser(request)
    request match {
      case Prefers.Json() =>
        createDescendant(uri, user)
          .map(s =>
            renderStreamJson(s, request))
          .getOrElse(BadRequest)

      case Accepts.Html() =>
        createDescendant(uri, user)
          .map(s =>
            Redirect(routes.Stream.getStream(s.uri)))
          .getOrElse(BadRequest)

      case _ =>
        BadRequest
    }
  }

  private def createDescendant(uri: String, user: User) =
    getParentPath(uri) flatMap { s =>
      models.Stream.createDescendant(s._1, s._2, user)
    }

  /**
   * Update an existing stream.
   */
  @SubjectPresent
  def postStreamUpdate(uri: String) = Action { implicit request => {
    val localUser: User = Application.getLocalUser(request)
    statusForm.bindFromRequest().fold(
      formWithErrors => BadRequest,
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
    models.Stream.findByUri(uri)
      .flatMap(x => canUpdateStreamStatus(x, poster))

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

  private def getParentPath(uri: String) = {
    val index = uri.lastIndexOf('/')
    if (index == -1 || index >= uri.length - 1)
      None
    else
      Some((uri.slice(0, index), uri.slice(index + 1, uri.length)))
  }
}

