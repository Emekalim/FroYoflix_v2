const { join, resolve } = require('path')
const { DefinePlugin } = require('webpack')

const mode = process.env.NODE_ENV?.trim() || 'development'
const isDev = mode === 'development'
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

// Load .env file if it exists
try {
  require('dotenv').config({ path: resolve(__dirname, '..', '.env') })
} catch (e) {
  console.warn('⚠️  dotenv not installed or .env file not found')
}

/** @type {(parentDir: string, alias?: Record<string, string>, aliasFields?: (string | string[]), filename?: string) => import('webpack').WebpackOptionsNormalized} */
module.exports = (parentDir, alias = {}, aliasFields = 'browser', filename = 'app') => ({
  devtool: 'source-map',
  entry: [join(__dirname, 'main.js')],
  stats: { warnings: false },
  output: {
    path: join(parentDir, 'build'),
    filename: 'renderer.js'
  },
  mode,
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: {
              dev: isDev
            },
            emitCss: !isDev,
            hotReload: isDev
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      },
      {
        // required to prevent errors from Svelte on Webpack 5+
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  },
  resolve: {
    aliasFields: [aliasFields],
    alias: {
      ...alias,
      '@': __dirname,
      module: false,
      url: false,
      debug: resolve(__dirname, './modules/debug.js'),
      'bittorrent-tracker/lib/client/websocket-tracker.js': resolve('../node_modules/bittorrent-tracker/lib/client/websocket-tracker.js')
    },
    extensions: ['.mjs', '.js', '.svelte']
  },
  plugins: [
    new DefinePlugin({
      'process.env.TMDB_API_KEY': JSON.stringify(process.env.TMDB_API_KEY || ''),
      'process.env.TRAKT_CLIENT_ID': JSON.stringify(process.env.TRAKT_CLIENT_ID || ''),
      'process.env.TRAKT_ACCESS_TOKEN': JSON.stringify(process.env.TRAKT_ACCESS_TOKEN || ''),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: join(__dirname, 'public') }
      ]
    }),
    new HtmlWebpackPlugin({
      filename: filename + '.html',
      inject: false,
      templateContent: ({ htmlWebpackPlugin }) => /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset='utf-8'>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#17191C">
<title>FroYo</title>

<link rel="preconnect" href="https://i.ytimg.com">
<link rel="preconnect" href="https://www.youtube-nocookie.com">
<link rel="preconnect" href="https://s4.anilist.co/">
<link rel="preconnect" href="https://graphql.anilist.co/">
<link rel="preconnect" href="https://cdn.myanimelist.net/">
<link rel='icon' href='/icon_filled.png' type="image/png">
${htmlWebpackPlugin.tags.headTags}
</head>

<body class="dark-mode with-custom-webkit-scrollbars">
${htmlWebpackPlugin.tags.bodyTags}
</body>

</html> `
    })],
  target: 'web'
})
