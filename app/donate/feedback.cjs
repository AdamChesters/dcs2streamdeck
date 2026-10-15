// Only the public feedback relay URL belongs in the application. Webhook secrets stay on the server.
const content = require('./content.json')
const FEEDBACK_ENDPOINT = content.feedback.endpoint

function feedbackPayload(fields, version, appId) {
  if (!fields || typeof fields !== 'object') throw new Error('Please fill in your name, email and message.')
  const limits = Object.fromEntries(content.feedback.fields.map(field => [field.id, field.maxLength]))
  const clean = {}
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof fields[key] !== 'string' || !fields[key].trim() || fields[key].trim().length > limit) {
      throw new Error(`Please check your ${key}.`)
    }
    clean[key] = fields[key].trim()
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new Error('Please enter a valid email address.')
  return { app: appId, ...clean, version }
}

async function sendFeedback(fields, version, appId, endpoint = FEEDBACK_ENDPOINT, request = fetch) {
  let payload
  try { payload = feedbackPayload(fields, version, appId) } catch (error) { return { ok: false, error: error.message } }
  if (!endpoint) return { ok: false, error: 'Feedback delivery is not configured yet. Please use Discord for now.' }
  try {
    const response = await request(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
    if (response.status !== content.feedback.ack.httpStatus) throw new Error('delivery failed')
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('invalid acknowledgement type')
    const chunks = []
    let received = 0
    for await (const chunk of response.body) {
      received += chunk.length
      if (received > content.feedback.ack.maxBytes) throw new Error('acknowledgement too large')
      chunks.push(Buffer.from(chunk))
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (result?.ok !== true || Object.keys(result).length !== 1) throw new Error('delivery not confirmed')
    return { ok: true }
  } catch { return { ok: false, error: content.feedback.failure } }
}

module.exports = { feedbackPayload, sendFeedback }
