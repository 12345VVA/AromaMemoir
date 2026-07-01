// 本地持久化启动入口（绕过 @midwayjs/mock 的 test 生命周期，直接拉起 koa HTTP 服务）
// 用法：NODE_ENV=local node bootstrap-local.js
const { Bootstrap } = require('@midwayjs/bootstrap');
const { MainConfiguration } = require('./dist/configuration');

Bootstrap.configure({
  imports: MainConfiguration,
}).run();
