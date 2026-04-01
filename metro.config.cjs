const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const projectRoot = escapeRegex(__dirname);

config.resolver.blockList = [
  new RegExp(`^${projectRoot}[\\/]functions[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]backend[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]\\.firebase[\\/].*`),
];

module.exports = config;
