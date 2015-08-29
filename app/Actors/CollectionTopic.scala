package Actors

import helper.ActorHelper

/**
 * Name used on the event bus to identify stream collections.
 */
abstract class CollectionTopic {
  val value: String
}

case class StreamCollectionTopic(uri: models.StreamUri) extends CollectionTopic {
  val value = ("@stream-collection/" +
    uri.components()
      .map(ActorHelper.normalizeName(_))
      .mkString("/")).toLowerCase()
}

case class TagCollectionTopic(tag: models.StreamTag) extends CollectionTopic {
  val value = ("@tag-collection/" +
    ActorHelper.normalizeName(tag)).toLowerCase()
}

object CollectionTopic {
  /**
   * Get the topic of a stream.
   */
  def forStream(uri: models.StreamUri): StreamCollectionTopic =
    StreamCollectionTopic(uri)

  def forStream(stream: models.Stream): StreamCollectionTopic =
    forStream(stream.getUri())

  /**
   * Get the topic of a tag.
   */
  def forTag(tag: models.StreamTag): TagCollectionTopic =
    TagCollectionTopic(tag)
}