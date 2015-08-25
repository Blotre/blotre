package controllers

import Actors.{CollectionSupervisor, StreamSupervisor}
import play.api.data.validation._
import play.api.mvc._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.Play.current
import play.utils.UriEncoding
import scala.collection.immutable._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import helper.ImageHelper

/**
 *
 */
object Stream extends Controller {

  import models.Serializable._
  import ControllerHelper._

  val AcceptsPng = Accepting("image/png")

  def uriMap(uri: String): Seq[(String, String)] =
    (uri
      .split('/')
      .foldLeft(("", Seq[(String, String)]())) { (p, c) =>
      (p._1 + "/" + c, p._2 :+(c, (p._1 + "/" + c)))
    })._2

  /**
   * Stream root index page.
   *
   * Displays a list of streams for searching.
   */
  def index = Action { implicit request =>
    Ok(views.html.stream.index.render(request))
  }

  /**
   * Lookup a stream.
   *
   * Supports:
   * png - Render 1x1 image of the current status.
   *
   * html - View of the stream.
   */
  def getStream(uri: String) = Action { implicit request =>
    val pathAndExt = uri.split('.')
    val path = pathAndExt(0)
    if (pathAndExt.length == 2 && pathAndExt(1) == "png")
      renderStreamStatusPng(path)
    else {
      render {
        case Accepts.Html() =>
          renderStream(Application.getLocalUser(request), path)

        case AcceptsPng() =>
          renderStreamStatusPng(path)
      }
    }
  }

  /**
   * Render a stream as html.
   *
   * Displays a try create page if the stream does not exist but the parent does.
   */
  def renderStream(user: models.User, uri: String)(implicit request: RequestHeader) =
    models.Stream.findByUri(uri) map { s =>
      Ok(views.html.stream.stream.render(s, s.getChildren(), uriPath = uriMap(s.uri), request))
    } getOrElse {
      tryCreateDescendant(user, uri)
    }

  /**
   * Render a stream's current status as a 1x1 PNG image.
   */
  def renderStreamStatusPng(uri: String) =
    models.Stream.findByUri(uri) map { s =>
      val img = ImageHelper.createImage(s.status.color)
      noCache(Ok(ImageHelper.toPng(img)))
        .as("image/png")
    } getOrElse(NotFound)

  /**
   * Checks if child stream can created and displays a create page.
   *
   * A child stream can only be created if its direct parent exists and
   * is owned by the current user.
   */
  def tryCreateDescendant(user: models.User, uri: String)(implicit request: RequestHeader): Result =
    getRawParentPath(uri) flatMap {
      case (parentUri, childUri) =>
        models.Stream.toValidStreamName(childUri) flatMap { validChildName =>
          models.Stream.findByUri(parentUri) flatMap { parent =>
            models.Stream.asEditable(user, parent) map { stream =>
              Ok(views.html.stream.createChild.render(stream, validChildName, request))
            }
          }
        }
    } getOrElse {
      NotFound(views.html.notFound.render(request))
    }

  private def createDescendant(user: models.User, uri: String): Option[models.Stream] =
    getParentFromPath(uri) flatMap { case (parent, childUri) =>
      models.Stream.toValidStreamName(childUri) flatMap { childName =>
        createDescendant(user, parent, childName)
      }
    }

  private def createDescendant(user: models.User, parent: models.Stream, name: models.StreamName): Option[models.Stream] =
    models.Stream.createDescendant(parent.uri, name, user) flatMap { newChild =>
      StreamApiController.addChild(user, true, parent, newChild)
    }

  private def getParentFromPath(uri: String) =
    getParentPath(uri) flatMap {
      case (parentUri, childUri) =>
        models.Stream.findByUri(parentUri).map(parent => (parent, childUri))
    }

  private def getRawParentPath(uri: String) = {
    val decodedUri = UriEncoding.decodePath(uri, "UTF-8")
    val index = decodedUri.lastIndexOf('/')
    if (index == -1 || index >= decodedUri.length - 1)
      None
    else {
      val parent = decodedUri.slice(0, index)
      val child = decodedUri.slice(index + 1, decodedUri.length)
      Some((parent, child))
    }
  }

  private def getParentPath(uri: String) =
    getRawParentPath(models.Stream.normalizeUri(uri).value) map { paths =>
      (paths._1, models.Stream.normalizeUri(paths._2))
    }
}

