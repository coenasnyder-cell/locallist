/* eslint-env node */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const projectRoot = escapeRegex(__dirname);

config.resolver.blockList = [
  new RegExp(`^${projectRoot}[\\/]functions[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]backend[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]\\.firebase[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]dist[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]dist-web-check[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]dist-web-check-2[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]\\.expo-export-check[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]git[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]master[\\/].*`),
  new RegExp(`^${projectRoot}[\\/]public[\\/].*`),
];

module.exports = config;
