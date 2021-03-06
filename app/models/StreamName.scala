package models

/**
 * Valid stream name.
 */
case class StreamName(value: String)
{
  override def equals(o: Any) = o match {
    case that: StreamName => that.value.equalsIgnoreCase(this.value)
    case _ => false
  }
}

object StreamName
{
  val validCharacter = """[ a-zA-Z0-9_\-$]"""

  private val pattern = (validCharacter + "{1,64}").r

  /**
   * Create a stream name from a string.
   */
  def fromString(name: String): Option[StreamName] = {
    val trimmed = name.trim()
    if (trimmed.matches(pattern.toString))
      Some(StreamName(trimmed))
    else
      None
  }
}