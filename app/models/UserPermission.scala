package models

import be.objectify.deadbolt.core.models.Permission
import scala.collection.JavaConversions._
import scalikejdbc._

@SerialVersionUID(1L)
case class UserPermission(
  id: Long,
  value: String) extends Permission
{
  def getValue(): String = value

  def save()(implicit session: DBSession = UserPermission.autoSession): UserPermission =
    UserPermission.save(this)(session)

  def destroy()(implicit session: DBSession = UserPermission.autoSession): Unit =
    UserPermission.destroy(id)(session)
}

object UserPermission extends SQLSyntaxSupport[UserPermission]
{
  def apply(c: SyntaxProvider[UserPermission])(rs: WrappedResultSet): UserPermission =
    apply(c.resultName)(rs)

  def apply(c: ResultName[UserPermission])(rs: WrappedResultSet): UserPermission =
    new UserPermission(
      id = rs.get(c.id),
      value = rs.get(c.value))

  def findByValue(u: User, value: String): Option[UserPermission] = {
    val perms = u.getUserPermissions
    for (p <- perms if p.value.equalsIgnoreCase(value))
      return Some(p)
    None
  }

  def save(x: UserPermission)(implicit session: DBSession = autoSession): UserPermission = {
    withSQL {
      update(UserPermission)
        .set(column.value -> x.value)
        .where.eq(column.id, x.id)
    }.update.apply()
    x
  }

  def destroy(id: Long)(implicit session: DBSession = autoSession): Unit = withSQL {
    delete.from(UserPermission)
      .where.eq(column.id, id)
  }.update.apply()
}