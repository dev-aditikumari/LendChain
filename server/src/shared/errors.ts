export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
export const forbidden = (reason: string) => new HttpError(403, "Forbidden", reason);
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);
export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
