package Actors

import helper.ActorHelper

/**
 * Name used on the event bus to identify stream collections.
 */
case class CollectionTopic private(value: String)

object CollectionTopic
{
  /**
   * Get topic of already validated string path.
   */
  private def forString(path: String): CollectionTopic =
    CollectionTopic(path.toLowerCase())

  /**
   * Get the topic of a stream.
   */
  def forStream(path: models.StreamUri): Option[CollectionTopic] =
    Some(forString("@stream-collection/" +
      path.components()
        .map(ActorHelper.normalizeName(_))
        .mkString("/")))

  def forStream(stream: models.Stream): Option[CollectionTopic] =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): Option[CollectionTopic] =
    ActorHelper.normalizeName(tag.value)
      .filterNot(_.isEmpty)
      .map(x => forString("@tag-collection/" + x))
}