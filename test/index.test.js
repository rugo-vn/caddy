import process from 'node:process';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { CADDY_CONFIG_PORT } from '../src/constants.js';
import { createCaddyClient, createCaddyServer } from '../src/index.js';

chai.use(chaiHttp);

const INITIAL_CONFIG = {
  apps: {
    http: {
      servers: {
        rugoCaddyServer: {
          listen: [':443', ':80'],

          automatic_https: {
            disable: false,
            disable_redirects: false,
            skip: ['localhost'],
          },

          routes: [],
        },
      },
    },
  },
};

const SAMPLE_ROUTE = {
  '@id': 'sampleRoute',
  match: [{ path: ['/*'] }],
  handle: [
    {
      handler: 'static_response',
      status_code: 200,
      body: 'Hello, World.',
    },
  ],
};

const NEXT_SAMPLE_ROUTE = {
  ...SAMPLE_ROUTE,
  '@id': 'nextSampleRoute',
};

const NEXT_ROUTE = {
  '@id': 'sampleRoute',
  match: [{ path: ['/*'] }],
  handle: [
    {
      handler: 'static_response',
      status_code: 200,
      body: 'Hello, Next.',
    },
  ],
};

const NEXT_SKIP = ['localhost', 'haova.me'];

describe('Caddy test', function () {
  const configServerAddress = `http://localhost:${CADDY_CONFIG_PORT}`;

  // prepare
  let server, client;
  if (process.env.MOCK_SERVER) {
    it('should run server', async () => {
      server = await createCaddyServer();
    });
  }

  if (process.env.MOCK_CLIENT) {
    it('should create client', async () => {
      client = await createCaddyClient();
    });
  }

  // common
  const doRequest = async (method, path, payload) => {
    if (client) {
      return await client[method](path, payload);
    }

    const res = await chai
      .request(configServerAddress)
      [method](path)
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res).to.has.property('status', 200);

    return res.body;
  };

  const getConfig = async () => {
    return await doRequest('get', '/config/');
  };

  // test
  it('should delete config', async () => {
    await doRequest('delete', '/config/');
  });

  it('should get null config', async () => {
    const config = await getConfig();
    expect(config).be.eq(null);
  });

  it('should load config', async () => {
    await doRequest('post', '/load', INITIAL_CONFIG);

    const config = await getConfig();
    expect(config).to.be.deep.eq(INITIAL_CONFIG);
  });

  it('should get config path', async () => {
    const body = await doRequest(
      'get',
      '/config/apps/http/servers/rugoCaddyServer/listen'
    );

    expect(body).to.be.deep.eq(
      INITIAL_CONFIG.apps.http.servers.rugoCaddyServer.listen
    );
  });

  it('should push item into config path', async () => {
    await doRequest(
      'post',
      '/config/apps/http/servers/rugoCaddyServer/routes',
      SAMPLE_ROUTE
    );

    const config = await getConfig();
    expect(config.apps.http.servers.rugoCaddyServer.routes[0]).to.be.deep.eq(
      SAMPLE_ROUTE
    );
  });

  it('should get item from id', async () => {
    const body = await doRequest('get', `/id/${SAMPLE_ROUTE['@id']}`);
    expect(body).to.be.deep.eq(SAMPLE_ROUTE);
  });

  it('should replace item by id', async () => {
    await doRequest('patch', `/id/${SAMPLE_ROUTE['@id']}`, NEXT_ROUTE);
    const config = await getConfig();
    expect(config.apps.http.servers.rugoCaddyServer.routes[0]).to.be.deep.eq(
      NEXT_ROUTE
    );
  });

  it('should push initital again', async () => {
    await doRequest(
      'put',
      '/config/apps/http/servers/rugoCaddyServer/routes/0',
      NEXT_SAMPLE_ROUTE
    );

    const config = await getConfig();
    expect(config.apps.http.servers.rugoCaddyServer.routes[0]).to.be.deep.eq(
      NEXT_SAMPLE_ROUTE
    );
  });

  it('should replace array', async () => {
    await doRequest(
      'post',
      '/config/apps/http/servers/rugoCaddyServer/automatic_https/skip',
      '"haova.me"'
    );

    const config = await getConfig();
    expect(
      config.apps.http.servers.rugoCaddyServer.automatic_https.skip
    ).to.be.deep.eq(NEXT_SKIP);
  });

  if (process.env.MOCK_SERVER) {
    it('should close server', async () => {
      await server.close();
    });
  }
});
