import { invariant } from 'outvariant'
import { until } from '@open-draft/until'
import { HttpRequestEventMap, IS_PATCHED_MODULE } from '../../glossary'
import { Interceptor } from '../../Interceptor'
import { uuidv4 } from '../../utils/uuid'
import { toInteractiveRequest } from '../../utils/toInteractiveRequest'
import type { XMLHttpRequestEnvironment } from '../XMLHttpRequest'

export type FetchEnvironment = Pick<typeof globalThis, 'fetch'>

export class FetchInterceptor extends Interceptor<HttpRequestEventMap> {
  static symbol = Symbol('fetch')

  constructor() {
    super(FetchInterceptor.symbol)
  }

  protected checkEnvironment(
    environment: FetchEnvironment | XMLHttpRequestEnvironment
  ): environment is FetchEnvironment {
    return 'fetch' in environment && typeof environment.fetch !== 'undefined'
  }

  protected setup(environment: FetchEnvironment) {
    const pureFetch = environment.fetch

    invariant(
      !(pureFetch as any)[IS_PATCHED_MODULE],
      'Failed to patch the "fetch" module: already patched.'
    )

    environment.fetch = async (input, init) => {
      const requestId = uuidv4()
      const request = new Request(input, init)

      this.logger.info('[%s] %s', request.method, request.url)

      const interactiveRequest = toInteractiveRequest(request)

      this.logger.info(
        'emitting the "request" event for %d listener(s)...',
        this.emitter.listenerCount('request')
      )
      this.emitter.emit('request', interactiveRequest, requestId)

      this.logger.info('awaiting for the mocked response...')

      const resolverResult = await until(async () => {
        await this.emitter.untilIdle(
          'request',
          ({ args: [, pendingRequestId] }) => {
            return pendingRequestId === requestId
          }
        )
        this.logger.info('all request listeners have been resolved!')

        const [mockedResponse] = await interactiveRequest.respondWith.invoked()
        this.logger.info('event.respondWith called with:', mockedResponse)

        return mockedResponse
      })

      if (resolverResult.error) {
        console.error(`${request.method} ${request.url} net::ERR_FAILED`)
        const error = Object.assign(new TypeError('Failed to fetch'), {
          cause: resolverResult.error,
        })
        return Promise.reject(error)
      }

      const mockedResponse = resolverResult.data

      if (mockedResponse && !request.signal?.aborted) {
        this.logger.info('received mocked response:', mockedResponse)
        const responseCloine = mockedResponse.clone()

        this.emitter.emit(
          'response',
          responseCloine,
          interactiveRequest,
          requestId
        )

        const response = new Response(mockedResponse.body, mockedResponse)

        // Set the "response.url" property to equal the intercepted request URL.
        Object.defineProperty(response, 'url', {
          writable: false,
          enumerable: true,
          configurable: false,
          value: request.url,
        })

        return response
      }

      this.logger.info('no mocked response received!')

      return pureFetch(request).then((response) => {
        const responseClone = response.clone()
        this.logger.info('original fetch performed', responseClone)

        this.emitter.emit(
          'response',
          responseClone,
          interactiveRequest,
          requestId
        )

        return response
      })
    }

    Object.defineProperty(environment.fetch, IS_PATCHED_MODULE, {
      enumerable: true,
      configurable: true,
      value: true,
    })

    this.subscriptions.push(() => {
      Object.defineProperty(environment.fetch, IS_PATCHED_MODULE, {
        value: undefined,
      })

      environment.fetch = pureFetch

      this.logger.info('restored native "fetch"!', environment.fetch.name)
    })
  }
}
