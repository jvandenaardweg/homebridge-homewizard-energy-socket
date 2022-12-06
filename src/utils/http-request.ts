import https from "https";
import http, { RequestOptions, IncomingHttpHeaders } from "http";

export interface HttpRequestResponse<T> {
  readonly headers: IncomingHttpHeaders;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string | undefined;
  readonly url: string;
  readonly body: string;
  json(): Promise<T>;
}

type HttpRequestOptions = Omit<
  RequestOptions,
  "protocol" | "host" | "path" | "port" | "hostname" | "localAddress" | "href"
> & {
  body?: string;
};

/**
 * A little type-safe `http` / `https` wrapper, similar to `fetch`. So we can replace it with a fetch implementation later on when needed.
 *
 * Why?
 *
 * There seems to be a bug in node-fetch on Node 18, which makes `response.json()` not work on our PUT requests.
 *
 * For now, this `httpRequest` method will do, so we don't have to import any dependencies.
 */
export const httpRequest = <T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpRequestResponse<T>> =>
  new Promise((resolve, reject) => {
    let request = http.request;

    if (url.startsWith("https")) {
      request = https.request;
    }

    const { body } = options || {};

    const { host, pathname, protocol, port } = new URL(url);

    const requestOptions = {
      protocol,
      host,
      path: pathname,
      port: port || 80,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body?.length || 0,
        ...options?.headers,
      },
      ...options,
    } satisfies RequestOptions;

    console.log(url, requestOptions);

    const req = request(requestOptions, (res) => {
      const body = new Array<Buffer | string>();
      const statusText = res.statusMessage;

      res.on("data", (chunk) => body.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const { statusCode, headers } = res;
        const joinedBody = body.join("");

        if (!statusCode) {
          return reject(
            new Error(
              `Request failed. No status code returned. Response body: ${joinedBody}`
            )
          );
        }

        const ok = !!(statusCode >= 200 && statusCode < 300);

        // fetch-like json method
        const json = async (): Promise<T> => {
          return new Promise((resolve, reject) => {
            try {
              const json = JSON.parse(joinedBody) as T;

              resolve(json);
            } catch (err) {
              reject(err);
            }
          });
        };

        const response: HttpRequestResponse<T> = {
          ok,
          headers,
          json,
          status: statusCode,
          statusText,
          body: joinedBody,
          url,
        };

        return resolve(response);
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
