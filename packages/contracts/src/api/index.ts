/**
 * The wire format, in one place.
 *
 * These schemas have two consumers and that is the whole point of them living here.
 * `fastify-type-provider-zod` uses them on the server as validator *and serialiser*; the SPAs
 * use the inferred types and `zodResolver`. A shape written twice is a shape that eventually
 * disagrees with itself, and the disagreement surfaces as a field that is `undefined` in
 * production and fine in every test.
 */

export * from './admin';
export * from './builder';
export * from './choice';
export * from './common';
export * from './global';
export * from './leads';
export * from './media';
export * from './umrah';
