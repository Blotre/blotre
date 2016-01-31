var webpack = require("webpack");

var MINIFY = false;

var plugins = [
    new webpack.optimize.CommonsChunkPlugin({
        name:"common",
        filename: "common.bundle.js",
        minChunks: Infinity
    }),

    new webpack.ProvidePlugin({
       $: "jquery",
       jquery: "jQuery"
    }),
];

if (MINIFY) {
    plugins.push(new webpack.optimize.UglifyJsPlugin({minimize: true}));
}

module.exports = {
    entry: {
        common: [
            './client/external/spectrum.js',
            './client/external/bootbox.min.js',
            'react',
            'react-dom'],
        account_authorizations: "./client/js/account_authorizations.jsx",
        side_bar: "./client/js/side_bar.jsx",
        stream_main: "./client/js/stream_main.js"
    },
    devtool: "source-map",

    output: {
        path: "./public/js/",
        filename: "[name].js"
    },

    module: {
        loaders: [{
            test: /\.jsx?$/,
            loader: 'babel',
            exclude: /node_modules/
        }]
    },
    plugins: plugins
};
