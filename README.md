<div align="center">
    <a href="https://blot.re">
        <img src="documentation/readme-logo.png" width="280" alt="Blot're" />
    </a>
</div>

* [Developer and API documentation](https://github.com/Blotre/blotre/wiki)
* [Report an issue](https://github.com/Blotre/blotre/issues)
* [Development and Contributing](#development-and-contributing)

Blot’re is what’s happening now. The past is dead. Nobody’s got time for text. Blot’re is communication reimagined for today’s hyperconnected always on millennials, and their toasters.

#### I still don't understand
An analogy perhaps:

* Take Facebook. Now subtract out the newsfeeds, friends, photos, like buttons, messaging, profiles, videos, groups, advertising platform, etc. That’s Blot’re.
* Think Instagram, except with 1x1 images and all your followers are household appliances.

But it’s so much more than just another Facebook or Twitter clone. Blot’re is the world’s first IoT ready social network.

By 2016, literally everything, including your toaster, will connect to the internet. So much new data, what are we to do? Though a revolutionary context aware encoding system based on decades of machine learning, Blot’re integrates, ingests, and processes disparate data streams, outputting dense pellets of comprehensible information. All with *practically* no information loss.

#### What people are saying
But don’t take our word for it. Check out what people are saying:

> At first, I was like, WTF? This is the revolutionary new app everyone at work has been talking about? It’s soooo simple. And yet, that’s really the genius of it. I must have spent three days solid just thinking up new ways Blot’re could simplify my life.

> Perfect #996515 toast once again, thanks Blot’re!!!

> As an early adopter, I ironically liked Blot're to appear cool. But then that got too popular. Now I just like it meta ironically.


So try Blot’re today, you’ll never look back.


# API
Hey you! You, the Github lurker with the hot new app. Yeah you! We love you. A lot.

Developers are what make Blot're great. So, to show our wholehearted love, we've built an intuitive and powerful set of APIs for you to integrate into your application. Hook your app up to the the color graph today.

Check out [our documentation](develop) to get started.

### REST
With the [Blot're REST API][REST], you can get up and running in seconds.

If you know how to enter a url, you're already more than half way there. For example, getting a stream:

```
https://blot.re/v0/api/stream/552f25793004785713de6750
```

```
{
  "id": "552f25793004785713de6750",
  "name": "child1",
  "uri": "user/child1",
  "created": 1429153145591,
  "updated": 1429160419760,
  "status": {
    "color": "#0000ff",
    "created": 1429160419760,
    "poster": "552f24f33004785713de674e"
  },
  "owner": "552f24f33004785713de674e"
}
```

Easy.


### Websockets
Did you order some realtime with that?

Blot're is realtime first and your app should be too. [Our websocket subscription API](https://github.com/mattbierner/blotre/wiki/subscriptions) allows your app to receive  real time updates. Subscribe to a single stream or a collection of stream.

We also provide methods a [websocket based response API](https://github.com/mattbierner/blotre/wiki/Web-Socket-Response-API) that can perform most of the same operations as the REST API.


### Authorization
GETs are boring. You live for the excitement of PUTs and POSTs, and maybe a DELETE or two... but let's not get too carried away here.

Blot're provides OAuth2 based authorization. This allows users to authorize your app to change their data over both the REST and websocket based APIs. Checkout [our detailed walkthough](https://github.com/mattbierner/blotre/wiki/Authorization) that covers how to register a new client application, recieve authorization from a user, and make authorized requests.


# Development and Contributing
Want to run Blot're on your very own devbox or help make Blot're better? Of course you do!

Here are the high level components you need to know about to get Blot're running:

* Server - [Play! Framework][play] using Scala.
* Database - [MongoDB][mongo].
* Client Javascript - [Webpack][webpack] for bundling.

### Configure the Server
To get your very own copy of Blot're up and running, you'll have to make just a few config changes. Not that we aren't BFFs and all, but even friends shouldn't share their client secrets.

In `conf/play-authentication/mine.conf` replace the `XXX` with your credentials. And you may want to change `application.secret` in `conf/application.conf`. We're not saying the current one is insecure or anything, but variety is always good.

You can add these settings in `FILE.prod.conf` and `FILE.test.conf` and Blot're will automatically pick them up for builds, but the files will be ignored by git.

### Generate Client Javascript
Javascript source is stored in `./client/js`. Blot're bundles the Javascript using [Webpack][webpack] for both development and production. This repo does not include the generated Javascript files, so you must generate them locally for development.

For development, first install all the required tools:

```bash
# Install webpack
$ npm install -g webpack

# Install other Javascript deps
$ npm install
```

Now generate the code:

```bash
$ webpack --watch
```

This generates the required Javascript and automatically recompiles whenever the input sources change.

For production, the `stage` and `dist` tasks automatically run Webpack using `webpack.prod.config.js`.

### Running Blot're for Development
Time for the fun part: running Blot're on your very own devbox!

1. Make sure that a [MongoDB database][mongodb] is running: `$ sudo mongodb`
   Blot're expects the database on port `27017` by default, but this can be configured in `conf/database.conf`
2. Start the Play development server: `$ activator ~run`

That's it! You can access Blot're at http://localhost:9000 .

The `~run` command will automatically recompile any server file changes. Make sure to run `webpack --watch` on another terminal to recompile Javascript file changes too.

### Pushing Blot're to Production
To generate a production build of Blot're and automatically push it to a server:

1. Generate a build: `$ activator stage`. This automatically runs Webpack too.
2. Follow the instructions in [this repo](https://github.com/Blotre/deploy) to setup a server to receive the deployment.
3. Push the deployment to the server by running: `$ ./deploy YOUR_SERVER_DOT_RE`


[develop]: https://github.com/mattbierner/blotre/wiki
[rest]: https://github.com/mattbierner/blotre/wiki/REST


[play]: https://www.playframework.com
[mongo]: https://www.mongodb.com
[webpack]: http://webpack.github.io
