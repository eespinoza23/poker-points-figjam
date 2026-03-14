const path = require("path");

module.exports = {
  entry: "./code.tsx",
  output: {
    filename: "code.js",
    path: path.resolve(__dirname),
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
};
