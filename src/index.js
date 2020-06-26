const { CookieKonnector, log, errors } = require('cozy-konnector-libs')
const cheerio = require('cheerio')

const baseUrl = 'https://www.doctolib.fr'

class DoctolibConnector extends CookieKonnector {
  async testSession() {
    return false
  }

  async fetch(fields) {
    this.fetchedData = {}
    await this.authenticate(fields)
    const docs = await this.getDocs()
    await this.saveFiles(docs, fields)
  }

  async getDocs() {
    return (await this.request.get(
      `${baseUrl}/account/documents.json?page=1`
    )).documents.map(doc => ({
      vendorRef: doc.id,
      fileurl: baseUrl + doc.url,
      filename: `${doc.shared_at}_${doc.name}_${doc.created_by}.pdf`
    }))
  }

  async authenticate({ login, password }) {
    try {
      const html = await this.request.get(`${baseUrl}/sessions/new`, {
        json: false
      })
      const csrf = cheerio
        .load(html)(`meta[name=csrf-token]`)
        .attr('content')
      const body = await this.request.post(`${baseUrl}/login.json`, {
        headers: {
          'x-csrf-token': csrf,
          Referer: `${baseUrl}/sessions/new`
        },
        json: true,
        body: {
          remember: true,
          kind: 'patient',
          username: login,
          password
        }
      })
      this.fetchedData.user = body
    } catch (err) {
      log('error', err.message)
      if (err.statusCode === 401) {
        throw new Error(errors.LOGIN_FAILED)
      }
      throw err
    }
  }
}

const connector = new DoctolibConnector({
  debug: true,
  cheerio: false,
  json: true,
  jar: true
})

connector.run()
