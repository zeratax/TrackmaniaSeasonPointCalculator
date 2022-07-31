function generateRandomString (length) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

async function generateCodeChallenge (codeVerifier) {
  const digest = await window.crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(codeVerifier))

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function calculatePoint (p) {
  if (!p) { return 0 }
  const tier = Math.ceil(Math.log10(p))
  if (tier < 2) {
    return 40000 / p
  }
  if (tier < 7) {
    const basePoints = 4000 / Math.pow(2, tier - 1)
    const rankMultiplier = Math.pow(10, tier - 1) / p + 0.9
    return basePoints * rankMultiplier
  }
  return 0
}
function calculateAll () {
  let total = 0
  let saveRanks = ''
  document.querySelectorAll('.rank').forEach(rankElement => {
    let value = rankElement.value
    if (!isNaN(parseInt(value))) {
      total += calculatePoint(value)
    } else {
      value = ''
    }
    saveRanks += value + ':'
  })
  document.getElementById('result').innerHTML = Math.round(total)
  window.localStorage.setItem('records', saveRanks)
  document.getElementById('link').value = window.location.href.split('?')[0] + `?ranks=${saveRanks}`
}

function reset () { // eslint-disable-line no-unused-vars
  let saveRanks = ''
  const confirmed = window.confirm('Are you sure? All data will be lost.')
  if (confirmed) {
    document.querySelectorAll('.rank').forEach(rankElement => {
      rankElement.value = ''
      const event = new Event('change')
      rankElement.dispatchEvent(event)
      saveRanks += ':'
    })
    document.getElementById('result').innerHTML = 0
    window.localStorage.setItem('records', saveRanks)
    document.querySelector('#link').value = window.location.href.split('?')[0] + `?ranks=${saveRanks}`
  }
}

function copy (input) { // eslint-disable-line no-unused-vars
  input.select()
  if (navigator.clipboard) {
    navigator.clipboard.writeText(input.value).then(() => {
      console.log('Copied to clipboard successfully.')
    }, (err) => {
      console.log('Failed to copy the text to clipboard.', err)
    })
  } else if (window.clipboardData) {
    window.clipboardData.setData('Text', input.value)
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // SETUP UI ELEMENTS
  console.debug('Trackmania Season Point Calculator')
  const rankElements = document.querySelectorAll('.rank')
  rankElements.forEach(rankElement => {
    rankElement.onchange = () => {
      const point = rankElement.value
      const pointElement = document.querySelector(`#p${rankElement.getAttribute('id')}`)
      pointElement.innerHTML = Math.round(parseInt(calculatePoint(point))) || ''
      calculateAll()
    }
  })
  const queryString = window.location.search
  const urlParams = new URLSearchParams(queryString)
  let savedRanks = urlParams.get('ranks')
  console.debug(`savedRanks: "${savedRanks}"`)
  if (!savedRanks) {
    console.debug('no savedRanks query parameter, checking local storage...')
    savedRanks = window.localStorage.getItem('records')
  }
  if (savedRanks) {
    console.debug('savedRanks found!')
    const savedRanksArray = savedRanks.split(':')
    let i = 0
    document.querySelectorAll('.rank').forEach(rankElement => {
      const rank = savedRanksArray[i]
      if (!isNaN(parseInt(rank))) {
        rankElement.value = rank
        const event = new Event('change')
        rankElement.dispatchEvent(event)
      }
      i++
    })
  } else {
    console.debug('no savedRanks found!')
  }

  const API_ENDPOINT = 'https://api.trackmania.com'
  const CLIENT_ID = 'f1aca30ec0e5b7454537'
  const REDIRECT_URI = encodeURIComponent(`${window.location.origin}${window.location.pathname}`)
  const SCOPE = encodeURIComponent('')

  const CODE = urlParams.get('code')

  if (!CODE) {
    // AUTH STAGE 1
    console.debug('generating auth link')

    const CODE_VERIFIER = generateRandomString(64)
    console.debug(`code_verifier: "${CODE_VERIFIER}"`)
    window.sessionStorage.setItem('code_verifier', CODE_VERIFIER)

    generateCodeChallenge(CODE_VERIFIER)
      .then(CODE_CHALLENGE => {
        console.debug(`code_challenge: "${CODE_CHALLENGE}"`)

        const API_OAUTH_URL = new URL(`${API_ENDPOINT}/oauth/authorize`)
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: CLIENT_ID,
          scope: SCOPE,
          redirect_uri: REDIRECT_URI,
          code_challenge: CODE_CHALLENGE,
          code_challenge_method: 'S256'
          // state: CODE_CHALLENGE
        })
        API_OAUTH_URL.search = params

        const loginButton = document.querySelector('#login-button')
        loginButton.style.display = 'initial'
        loginButton.href = API_OAUTH_URL
      })
  } else {
    // AUTH STAGE 2
    console.debug('fetching auth token')
    const API_OAUTH_URL = new URL(`${API_ENDPOINT}/api/access_token`)
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: window.sessionStorage.getItem('code_verifier'),
      code: CODE
    })

    API_OAUTH_URL.search = params

    fetch(API_OAUTH_URL, { method: 'POST' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }

        console.debug(response)
        return response.json()
      })
      .then(response => {
        console.debug(response)
        const tokenType = response.token_type ?? ''
        const accessToken = response.access_token ?? ''
        const expiresIn = response.expires_in ?? 0

        window.sessionStorage.setItem('tokenType', tokenType)
        window.sessionStorage.setItem('accessToken', accessToken)
        window.sessionStorage.setItem('expiresIn', expiresIn)
      })
  }
})
