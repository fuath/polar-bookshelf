import {net} from "electron";
import {Logger} from '../../logger/Logger';
import {PassThrough, Readable} from 'stream';
import InterceptStreamProtocolRequest = Electron.InterceptStreamProtocolRequest;
import StreamProtocolResponse = Electron.StreamProtocolResponse;

const log = Logger.create();

export class StreamInterceptors {

    public static mockInterceptor(request: InterceptStreamProtocolRequest, callback: StreamCallback) {
        callback( <any> {
            statusCode: 200,
            headers: {
             'content-type': 'text/html'
            },
            data: createStream('HTTP 200 OK\r\n<h5>Response</h5>')
        });
    }

    /**
     * Call the given lambda with setTimeout so it doesn't execute in the
     * foreground.
     *
     * This is a workaround to fix an Electron lockup issue.
     *
     * @param delegate
     */
    public static withSetTimeout(delegate: () => void) {

        setTimeout(() => {
            delegate();
        }, 0);

    }

    public static handleWithNetRequest(request: InterceptStreamProtocolRequest, callback: StreamCallback) {

        log.debug("Handling request: ", request.url);

        const options = {
            method: request.method,
            url: request.url,
        };

        const responseStream = new PassThrough();

        const netRequest = net.request(options)
            .on('response', async (response) => {

                response.on('data', chunk => {
                    responseStream.push(chunk);
                });

                response.on('end', () => {
                    responseStream.push(null);
                });

                const headers = this.decodeBrokenResponseHeaders(response.headers);

                const streamProtocolResponse: CorrectStreamProtocolResponse = {
                    headers,
                    data: responseStream,
                    statusCode: response.statusCode
                };

                callback(streamProtocolResponse);

            })
            .on('abort', () => {
                log.error(`Request aborted: ${request.url}`);
                callback(undefined); // TODO test this.
            })
            .on('error', (error) => {
                log.error(`Request error: ${request.url}`, error);
                callback(undefined); // TODO test this.

            });

        Object.keys(request.headers).forEach(header => {
            log.debug("Setting request header: ", header);
            const headerValue = (<any> request.headers)[header];
            netRequest.setHeader(header, headerValue );
        });

        if (request.uploadData) {

            // We have to call netRequest.write on all the request.uploadData.

            log.debug("Writing data to request");
            request.uploadData.forEach(current => {
                netRequest.write(current.bytes);
            });

        }

        netRequest.end();

    }

    /**
     * As of 3.0-beta12 (and previous versions of Electron) the header keys and
     * values are all mangled.
     */
    private static decodeBrokenResponseHeaders(input: {[key: string]: string[]}): {[key: string]: string[]} {

        function decodeBrokenString(value: string): string {
            return value.substring(1, value.length - 1);
        }

        const result: {[key: string]: string[]} = {};

        for (const key of Object.keys(input)) {

            const newKey = decodeBrokenString(key);
            const newValue = input[key].map(current => decodeBrokenString(current));

            result[newKey] = newValue;

        }

        return result;
    }

}


export type StreamCallback = (stream?: ReadableStream | StreamProtocolResponse | CorrectStreamProtocolResponse) => void;

export interface CorrectStreamProtocolResponse {


    // Docs: http://electron.atom.io/docs/api/structures/stream-protocol-response

    /**
     * A Node.js readable stream representing the response body
     */
    data: ReadableStream | Readable;
    /**
     * An object containing the response headers
     */
    headers: Electron.Headers;
    /**
     * The HTTP response code
     */
    statusCode: number;

}


function createStream(text: string) {
    const rv = new PassThrough();
    rv.push(text);
    rv.push(null);
    return rv;
}