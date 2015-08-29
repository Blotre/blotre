package Actors

import helper.ActorHelper


/**
 * Path to a stream like object used to address actors.
 */
case class Topic private(value: String)

object Topic
{
  /**
   * Get the topic of a stream.
   */
  def forStream(path: models.StreamUri): Option[Topic] =
    ActorHelper.normalizeName(path.value)
      .filterNot(_.isEmpty)
      .map("streams/" + _)
      .map(Topic(_))

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): Option[Topic] =
    Some(ActorHelper.normalizeName(tag.value))
      .filterNot(_.isEmpty)
      .map("tags/" + _)
      .map(Topic(_))
}