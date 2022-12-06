import https from "https";
import http, { RequestOptions, IncomingHttpHeaders } from "http";

export interface HttpRequestResponse<T> {
  readonly headers: IncomingHttpHeaders;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string | undefined;
  readonly url: string;
  readonly data: T;
}

type HttpRequestOptions = Omit<
  RequestOptions,
  "protocol" | "host" | "path" | "port" | "hostname" | "localAddress" | "href"
> & {
  data?: object;
};

export const httpRequest = <T>(
  url: string,
  options: HttpRequestOptions
): Promise<HttpRequestResponse<T>> =>
  new Promise((resolve, reject) => {
    let request = http.request;

    if (url.startsWith("https")) {
      request = https.request;
    }

    const { host, pathname, protocol, port } = new URL(url);

    const req = request(
      {
        protocol,
        host,
        path: pathname,
        port,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      },
      (res) => {
        const body = new Array<Buffer | string>();
        const statusText = res.statusMessage;

        res.setEncoding("utf8");

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

          const ok = !!(statusCode && statusCode < 400);

          const data = JSON.parse(joinedBody) as T;

          const response: HttpRequestResponse<T> = {
            ok,
            headers,
            data,
            status: statusCode,
            statusText,
            url,
          };

          return resolve(response);
        });
      }
    );

    req.on("error", reject);

    if (options.data) {
      req.write(JSON.stringify(options.data));
    }

    req.end();
  });
