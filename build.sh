#!/bin/bash

rm -rf ./dist

xcaddy build \
  --output ./dist/caddy \
  --with github.com/ggicci/caddy-jwt