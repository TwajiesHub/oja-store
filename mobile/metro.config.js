// The app sits inside the website's repo, so the parent folder has its own node_modules (with its
// own copy of react). Metro must never resolve anything from there, or two copies of react could
// end up in the bundle and crash the app. Packages nested inside mobile/node_modules still resolve
// normally, so only the parent's node_modules is blocked.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const parentModules = path.resolve(__dirname, '..', 'node_modules')
const blockParent = new RegExp(`^${escape(parentModules)}[\\\\/].*`)

config.resolver.blockList = [].concat(config.resolver.blockList ?? [], blockParent)
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
