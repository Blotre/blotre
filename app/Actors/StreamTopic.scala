package Actors

import helper.ActorHelper


/**
 * Name used on the event bus to identify stream like objects.
 */
case class StreamTopic private(value: String)

object StreamTopic
{
  /**
   * Get topic of already validated string path.
   */
  private def forString(path: String): StreamTopic =
    StreamTopic(path.toLowerCase())

  /**
   * Get the topic of a stream.
   */
  def forStream(path: models.StreamUri): Option[StreamTopic] =
    Some(forString("@stream/" +
      path.components()
        .map(ActorHelper.normalizeName(_))
        .mkString("/")))

  def forStream(stream: models.Stream): Option[StreamTopic] =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): Option[StreamTopic] =
    ActorHelper.normalizeName(tag.value)
      .filterNot(_.isEmpty)
      .map(x => forString("@tag/" + x))
}