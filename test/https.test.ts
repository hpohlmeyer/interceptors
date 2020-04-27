/**
 * @jest-enviroment node
 */
import https, { IncomingMessage } from 'http'
import { RequestInterceptor } from '../src'

describe('https', () => {
  let interceptor: RequestInterceptor

  beforeAll(() => {
    interceptor = new RequestInterceptor()
    interceptor.use((req) => {
      if (['https://test.msw.io/'].includes(req.url)) {
        return {
          status: 301,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mocked: true }),
        }
      }
    })
  })

  afterAll(() => {
    interceptor.restore()
  })

  describe('given I perform request using https.request', () => {
    let res: IncomingMessage
    let resBody: string = ''

    beforeAll((done) => {
      const req = https.request('https://test.msw.io', (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => (resBody += chunk))
        res.on('end', done)
      })

      req.on('response', (original) => (res = original))
      req.end()
    })

    it('should return mocked status code', () => {
      expect(res.statusCode).toEqual(301)
    })

    it('should return mocked headers', () => {
      expect(res.headers).toHaveProperty('content-type', 'application/json')
    })

    it('should return mocked body', () => {
      expect(resBody).toEqual(JSON.stringify({ mocked: true }))
    })
  })

  describe('given I perform request using https.get', () => {
    let res: IncomingMessage
    let resBody: string = ''

    beforeAll((done) => {
      const req = https.get('https://test.msw.io', (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => (resBody += chunk))
        res.on('end', done)
      })

      req.on('response', (original) => (res = original))
      req.end()
    })

    it('should return mocked status code', () => {
      expect(res.statusCode).toEqual(301)
    })

    it('should return mocked headers', () => {
      expect(res.headers).toHaveProperty('content-type', 'application/json')
    })

    it('should return mocked body', () => {
      expect(resBody).toEqual(JSON.stringify({ mocked: true }))
    })
  })

  describe('given I cleaned up', () => {
    beforeAll(() => {
      interceptor.restore()
    })

    describe('and I perform an HTTPS request', () => {
      let error: Error
      let res: IncomingMessage

      beforeAll((done) => {
        const req = https.get('http://test.msw.io', (res) => {
          res.setEncoding('utf8')
          res.on('end', done)
        })

        req.on('error', (err) => {
          error = err
          done()
        })
        req.on('response', (original) => (res = original))
        req.end()
      })

      it('should return error', () => {
        expect(error).toBeTruthy
      })

      it('should not return any response', () => {
        expect(res).toBeUndefined()
      })
    })
  })
})
