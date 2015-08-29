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
    models.StreamTag.fromString(tag) map {
      getTagChildren(_, query, limit, offset)
    } getOrElse {
      Future.successful(ApiCouldNotProccessRequest(ApiError("Invalid tag")))
    }

  def getTagChildren(tag: models.StreamTag, query: String, limit: Int, offset: Int): Future[ApiResult[Seq[models.Stream]]] =
    if (query.isEmpty) {
      CollectionSupervisor.getTagCollection(tag, limit, offset) map { children =>
        ApiOk(children.flatMap(models.Stream.findByUri(_)))
      }
    } else {
      Future.successful(ApiOk(models.Stream.searchStreamWithTag(tag, query, limit)))
    }
}
