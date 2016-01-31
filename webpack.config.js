module.exports = {
    entry: {
        account_authorizations: "./client/js/account_authorizations.jsx",
        side_bar: "./client/js/side_bar.jsx",
    },
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
    }
};
