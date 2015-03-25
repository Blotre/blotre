package models

import scalikejdbc._
import org.joda.time.DateTime

@SerialVersionUID(1L)
case class TokenAction(
  id: Long,
  token: String,
  targetUserId: Long,
  kind: TokenAction.Kind.Kind,
  created: DateTime,
  expires: DateTime)
{
  def isValid(): Boolean =
    this.expires.isAfter(DateTime.now())

  def save()(implicit session: DBSession = TokenAction.autoSession): TokenAction =
    TokenAction.save(this)(session)

  def destroy()(implicit session: DBSession = TokenAction.autoSession): Unit =
    TokenAction.destroy(id)(session)
}


object TokenAction extends SQLSyntaxSupport[TokenAction]
{
  object Kind extends Enumeration
  {
    type Kind = Value;

    val EMAIL_VERIFICATION, PASSWORD_RESET = Value

    implicit def convertValue(v: Value): Kind = v.asInstanceOf[Kind]
  }

  private val VERIFICATION_TIME = 7 * 24 * 3600


  def apply(c: SyntaxProvider[TokenAction])(rs: WrappedResultSet): TokenAction =
    apply(c.resultName)(rs)

  def apply(c: ResultName[TokenAction])(rs: WrappedResultSet): TokenAction =
    new TokenAction(
      id = rs.get(c.id),
      token = rs.get(c.token),
      targetUserId = rs.get(c.targetUserId),
      kind = rs.get(c.kind),
      created = rs.get(c.created),
      expires = rs.get(c.expires))

  val t = TokenAction.syntax("t")

  def findByToken(token: String, kind: Kind.Kind)(implicit session: DBSession = autoSession): Option[TokenAction] = withSQL {
    select
      .from(TokenAction as t)
      .where.eq(column.token, token)
        .and.eq(column.kind, kind)
  }.map(TokenAction(t)).single.apply()

  def deleteByUser(u: User, kind: Kind.Kind)(implicit session: DBSession = autoSession): Unit = withSQL {
    delete.from(TokenAction)
      .where.eq(column.targetUserId, u.id)
        .and.eq(column.kind, kind)
  }.update.apply()

  def create(kind: Kind.Kind, token: String, targetUser: User): TokenAction =
    new TokenAction(
      0,
      token,
      targetUser.id,
      kind,
      created = DateTime.now(),
      expires = DateTime.now().plus(VERIFICATION_TIME * 1000)).save();

  def save(x: TokenAction)(implicit session: DBSession = autoSession): TokenAction = {
    withSQL {
      update(TokenAction)
        .set(column.token -> x.token)
        .set(column.targetedUserId -> x.targetedUserId)
        .set(column.kind -> x.kind)
        .set(column.created -> x.created)
        .set(column.expires -> x.expires)
        .where.eq(column.id, x.id)
    }.update.apply()
    x
  }

  def destroy(id: Long)(implicit session: DBSession = autoSession): Unit = withSQL {
    delete.from(TokenAction)
      .where.eq(column.id, id)
  }.update.apply()
}
