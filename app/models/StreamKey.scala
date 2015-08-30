package models

import models.Serializable._
import org.bson.types.ObjectId

/**
 * Unique stream identifier.
 */
sealed abstract class StreamKey

case class IdStreamKey(id: ObjectId) extends StreamKey
case class UriStreamKey(uri: StreamUri) extends StreamKey
case object NoneStreamKey extends StreamKey

object StreamKey {
  /**
   * Create a key for a uri.
   */
  def forUri(uri: StreamUri): StreamKey =
    UriStreamKey(uri)

  def forUri(uri: String): StreamKey =
    StreamUri.fromString(uri).map(forUri).getOrElse(NoneStreamKey)

  /**
   * Create a key for an id.
   */
  def forId(id: ObjectId): StreamKey =
    IdStreamKey(id)

  def forId(id: String): StreamKey =
    stringToObjectId(id).map(forId).getOrElse(NoneStreamKey)
}