import Koa from 'koa';
import Router from '@koa/router';
import objectPath from 'object-path';
import got from 'got';
import { join } from 'node:path';
import { koaBody } from 'koa-body';
import { CADDY_CONFIG_PORT, DEFAULT_GOT } from './constants.js';
import { tryParse } from './utils.js';

export const createCaddyServer = async () => {
  const app = new Koa();
  const router = new Router();

  let config = null;

  const handlePath = (ctx) => {
    const path = ctx.params['0']?.replace(/\//gm, '.');

    switch (ctx.method) {
      case 'DELETE':
        objectPath.del(config, path);
        break;

      case 'GET':
        ctx.body = objectPath.get(config, path) || 'null';
        break;

      case 'POST':
        objectPath.push(config, path, ctx.request.body);
        break;

      case 'PATCH':
        objectPath.set(config, path, ctx.request.body);
        break;

      case 'PUT':
        const ps = path.split('.');
        objectPath.insert(
          config,
          ps.slice(0, ps.length - 1).join('.'),
          ctx.request.body,
          parseInt(ps[ps.length - 1])
        );
        break;
    }

    ctx.type = 'application/json';
    ctx.body ||= {};
    ctx.status = 200;
  };

  const findPath = (path, value) => {
    const realPath = path.replace(/\//gm, '.');
    const obj = objectPath.get(config, realPath);

    if (!obj) return false;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const resultPath = findPath(join(path, i.toString()), value);
        if (resultPath) return resultPath;
      }
      return false;
    }

    if (typeof obj === 'object' && obj['@id'] === value) return path;

    if (typeof obj === 'object') {
      for (let key in obj) {
        const resultPath = findPath(join(path, key), value);
        if (resultPath) return resultPath;
      }

      return false;
    }

    return false;
  };

  router.all('/config/(.*)', handlePath);

  router.post('/load', (ctx) => {
    config = ctx.request.body;
    ctx.status = 200;
  });

  router.all(
    '/id/:id',
    async (ctx, next) => {
      ctx.params['0'] = findPath('', ctx.params.id);
      if (ctx.params['0']) {
        await next();
      } else {
        ctx.status = 404;
      }
    },
    handlePath
  );

  app.use(koaBody({ multipart: true, jsonStrict: false })); // parse body
  app.use(router.routes()).use(router.allowedMethods());

  const listener = await new Promise((resolve) => {
    const listener = app.listen(CADDY_CONFIG_PORT, () => {
      resolve(listener);
    });
  });

  return {
    close: async () => await listener.close(),
  };
};

export const createCaddyClient = () => {
  const methods = ['get', 'delete', 'post', 'patch', 'put'];

  const handlers = {
    base: `http://localhost:${CADDY_CONFIG_PORT}`,
  };

  for (const method of methods) {
    handlers[method] = async function (uri, payload) {
      if (this.isOffline) {
        return null;
      }

      try {
        return await got[method](
          join(this.base, uri),
          payload
            ? {
                json: tryParse(payload),
                ...DEFAULT_GOT,
              }
            : DEFAULT_GOT
        ).json();
      } catch (err) {
        if (err.message.indexOf('ECONNREFUSED') !== -1) {
          console.log('Caddy server is ' + colors.red.bold('offline'));
          this.isOffline = true;
          return null;
        } else {
          console.error(err.message);
        }
      }
    }.bind(handlers);
  }

  return handlers;
};
