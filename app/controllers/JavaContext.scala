package controllers

import play.api.mvc._

object JavaContext {
  import play.mvc.Http
  import play.core.j.JavaHelpers

  def withContext[Status](block: => Status)(implicit header: RequestHeader): Status = {
    try {
      Http.Context.current.set(JavaHelpers.createJavaContext(header))
      block
    }
    finally {
      Http.Context.current.remove()
    }
  }
}