import { JwtPayload } from './index';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }

  interface ParamsDictionary {
    [key: string]: string;
    [key: number]: string;
  }
}

export {};
