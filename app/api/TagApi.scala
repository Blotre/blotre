package api

import Actors.CollectionSupervisor

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

object TagApi
{
  /**
   *
   */
  def getTagChildren(tag: String, query: String, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    models.StreamTag.fromString(tag) map { tag =>
      models.StreamQuery.fromString(query) map {
        getTagChildren(tag, _, limit, offset)
      } getOrElse {
        getTagChildren(tag, limit, offset)

      }
    } getOrElse {
      Future.successful(ApiCouldNotProccessRequest(ApiError("Invalid tag")))
    }

  def getTagChildren(tag: models.StreamTag, query: models.StreamQuery, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    Future.successful(ApiOk(models.Stream.searchStreamWithTag(tag, query, limit)))

  def getTagChildren(tag: models.StreamTag,limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    CollectionSupervisor.getTagCollection(tag, limit, offset) map { children =>
      ApiOk(children.flatMap(models.Stream.findByUri(_)))
    }
}
