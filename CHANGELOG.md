# ChangeLog

# 0.2.1 - September 4, 2015
* Fixed client JS not allowing tags with numbers.
* The Policy is great, but also added link to terms.
** +100 legits
 
# 0.2.0 - August 31, 2015
* Added tags!
** Tags add metadata about how a stream is used.
** Also puts a stream into a tag collection which is shared between all users.
** View all streams with a tag at `https://blot.re/t/TAG_NAME`.
** Tag collections can be subscribed to just like normal stream collections.
** Added REST and websocket APIs for querying and editing tags.
** Added search based on tag including child search.
* Added search by child status.
* Added support for several more APIs using the socket send/response APIs.
** Delete child, create child, get child.
* Fixed socket API getStreams returning raw array without any correlation data.
* Fixed socket API getStreams not using query.
* Internal code refactoring to more logically structure things, remove duplication and better enforce data constraints.

# 0.1.2 - July 20, 2015
* Provided better json response on APIs hit without any authentication (vs wrong authentication).
** Message is still generic but tells what went wrong, either no token or token expired.
* Reduced default lifetime of access tokens to two hours.
* Kill collection actors after timeout if no subscribers are left.
* Fixed client search for streams using spaces or dollar sign in query.

## 0.1.1 - July 13, 2015
* Added `acknowledge` field to send/receive api.
** Gives caller control over acking success messages.

