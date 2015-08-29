package Actors

import helper.ActorHelper


/**
 * Name used on the event bus to identify stream like objects.
 */
case class StreamTopic private(value: String)

object StreamTopic
{
  /**
   * Get the topic of a stream.
   */
  def forStream(path: models.StreamUri): Option[StreamTopic] =
    Some(StreamTopic(
      "@stream/" + path.value.split("/")
        .map(ActorHelper.normalizeName(_))
        .flatten
        .mkString("/")))

  def forStream(stream: models.Stream): Option[StreamTopic] =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): Option[StreamTopic] =
    ActorHelper.normalizeName(tag.value)
      .filterNot(_.isEmpty)
      .map("@tag/" + _)
      .map(StreamTopic(_))
}