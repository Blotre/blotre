package models

/**
 * Normalized string search query.
 */
case class StreamQuery private(value: String)

object StreamQuery
{
  val invalidCharacter = """[^ a-zA-Z0-9_\-$#]"""

  /**
   * Normalizes a string query to escape potential regular expressions.
   */
  def fromString(query: String): Option[StreamQuery] = {
    val q = query.trim()
      .replaceAll(invalidCharacter, "")
      .replaceAllLiterally("$", "\\$")
    if (q.isEmpty) None else Some(StreamQuery(q))
  }
}