import { invariant } from 'outvariant'
import { HttpRequestEventMap, IS_PATCHED_MODULE } from '../../glossary'
import { InteractiveRequest } from '../../utils/toInteractiveRequest'
import { Interceptor } from '../../Interceptor'
import { AsyncEventEmitter } from '../../utils/AsyncEventEmitter'
import { createXMLHttpRequestProxy } from './XMLHttpRequestProxy'
import type { FetchEnvironment } from '../fetch'

export type XMLHttpRequestEnvironment = Pick<
  typeof globalThis,
  'XMLHttpRequest'
>

export type XMLHttpRequestEventListener = (
  request: InteractiveRequest,
  requestId: string
) => Promise<void> | void

export type XMLHttpRequestEmitter = AsyncEventEmitter<HttpRequestEventMap>

export class XMLHttpRequestInterceptor extends Interceptor<HttpRequestEventMap> {
  static interceptorSymbol = Symbol('xhr')

  constructor() {
    super(XMLHttpRequestInterceptor.interceptorSymbol)
  }

  protected checkEnvironment(
    environment: FetchEnvironment | XMLHttpRequestEnvironment
  ): environment is XMLHttpRequestEnvironment {
    return (
      'XMLHttpRequest' in environment &&
      typeof environment.XMLHttpRequest !== 'undefined'
    )
  }

  protected setup(environment: XMLHttpRequestEnvironment) {
    const logger = this.logger.extend('setup')

    logger.info('patching "XMLHttpRequest" module...')

    const PureXMLHttpRequest = environment.XMLHttpRequest

    invariant(
      !(PureXMLHttpRequest as any)[IS_PATCHED_MODULE],
      'Failed to patch the "XMLHttpRequest" module: already patched.'
    )

    environment.XMLHttpRequest = createXMLHttpRequestProxy({
      emitter: this.emitter,
      logger: this.logger,
    })

    logger.info(
      'native "XMLHttpRequest" module patched!',
      environment.XMLHttpRequest.name
    )

    Object.defineProperty(environment.XMLHttpRequest, IS_PATCHED_MODULE, {
      enumerable: true,
      configurable: true,
      value: true,
    })

    this.subscriptions.push(() => {
      Object.defineProperty(environment.XMLHttpRequest, IS_PATCHED_MODULE, {
        value: undefined,
      })

      environment.XMLHttpRequest = PureXMLHttpRequest
      logger.info(
        'native "XMLHttpRequest" module restored!',
        environment.XMLHttpRequest.name
      )
    })
  }
}
