package models

/**
 * Normalized string search query.
 */
case class StreamQuery private(value: String)

object StreamQuery
{
  /**
   * Normalizes a string query to escape potential regular expressions.
   */
  def fromString(query: String): Option[StreamQuery] =
    StreamName.fromString(query.trim()) flatMap { query =>
      val q = query.value.replaceAllLiterally("$", "\\$")
      if (q.isEmpty) None else Some(StreamQuery(q))
    }
}