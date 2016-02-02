/**
    Webpack base/development configuration.
*/
var webpack = require("webpack");

module.exports = {
    entry: {
        common: [
            './client/external/bootbox.min.js',
            'react',
            'reactcss',
            'react-color',
            'react-dom',

            "./client/js/header_bar.jsx",
            "./client/js/side_bar.jsx",
        ],
        account_authorizations: "./client/js/account_authorizations.jsx",
        stream_main: "./client/js/stream_main.js",
        client: './client/js/client.js',
        stream_create_child: './client/js/stream_create_child.js',
        stream_index: './client/js/stream_index.js',
        tag: './client/js/tag.js'
    },
    devtool: "source-map",

    output: {
        path: "./public/js/",
        filename: "[name].js"
    },

    module: {
        loaders: [{
            test: /\.js$/,
            exclude: [/node_modules/],
            loaders: ['babel-loader', 'react-map-styles'],
        }, {
            test: /\.jsx$/,
            exclude: [/node_modules/],
            loaders: ['jsx-loader', 'babel-loader', 'react-map-styles'],
        }]
    },
    plugins: [
        new webpack.optimize.CommonsChunkPlugin({
            name: "common",
            filename: "common.bundle.js",
            minChunks: Infinity
        }),

        new webpack.ProvidePlugin({
            $: "jquery",
            jquery: "jQuery"
        }),
    ]
};
