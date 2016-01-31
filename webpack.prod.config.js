/**
    Webpack production configuration.
*/
var webpack = require("webpack");
var config = require('./webpack.config.js')

module.exports = {
    entry: config.entry,
    output: {
        path: "./public/js/",
        filename: "[name].min.js"
    },
    module: config.module,
    plugins: config.plugins.concat([
        new webpack.optimize.UglifyJsPlugin({
            minimize: true
        })
    ])
};
