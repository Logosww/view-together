import { treaty } from '@elysiajs/eden';
import { backendApp } from '@/lib/server/elysia';

export const api =
  typeof process !== 'undefined'
    ? treaty(backendApp).api
    : treaty<typeof backendApp>('localhost:3000').api;
