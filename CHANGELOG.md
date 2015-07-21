# ChangeLog

## 0.1.1 - July 13, 2015
* Added `acknowledge` field to send/receive api.
** Gives caller control over acking success messages.

# 0.1.2 - July 20, 2015
* Provided better json response on APIs hit without any authentication (vs wrong authentication).
** Message is still generic but tells what went wrong, either no token or token expired.
* Reduced default lifetime of access tokens to two hours.
* Kill collection actors after timeout if no subscribers are left.
* Fixed client search for streams using spaces or dollar sign in query.