export const CADDY_CONFIG_PORT = 2019;

export const DEFAULT_GOT = {
  retry: { limit: 1 },
  followRedirect: false,
  throwHttpErrors: false,
  responseType: 'json',
  timeout: { request: 2000 },
};
