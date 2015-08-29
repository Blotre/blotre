package Actors

import helper.ActorHelper


/**
 * Name used on the event bus to identify stream like objects.
 */
case class Topic private(value: String)

object Topic
{
  /**
   * Get the topic of a stream.
   */
  def forStream(path: models.StreamUri): Option[Topic] =
    Some(Topic(
      "@stream/" + path.value.split("/")
        .map(ActorHelper.normalizeName(_))
        .flatten
        .mkString("/")))

  def forStream(stream: models.Stream): Option[Topic] =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): Option[Topic] =
    ActorHelper.normalizeName(tag.value)
      .filterNot(_.isEmpty)
      .map("@tag/" + _)
      .map(Topic(_))
}