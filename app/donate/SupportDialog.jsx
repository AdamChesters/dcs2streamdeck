import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import githubMark from './assets/github.svg'
import coffeeMark from './assets/buymeacoffee.svg'
import paypalMark from './assets/paypal.svg'
import content from './content.json'
import './SupportDialog.css'

const fields = Object.fromEntries(content.feedback.fields.map(field => [field.id, field]))

export default function SupportDialog({ onClose, appName, appLogo, appId, appVersion, updateStatus, updateBusy, updateAvailable, checkForUpdates, openExternal, sendFeedback }) {
  const dialog = useRef(null)
  const [feedback, setFeedback] = useState(false)
  const [contact] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`support-feedback-contact-${appId}-v1`)) || {} } catch { return {} }
  })
  const [name, setName] = useState(contact.name || '')
  const [email, setEmail] = useState(contact.email || '')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState('')
  const [sending, setSending] = useState(false)
  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && message.trim()

  useEffect(() => {
    const previous = document.activeElement
    dialog.current.showModal()
    return () => { dialog.current?.close(); previous?.focus() }
  }, [])

  async function visit(url) {
    setResult('')
    try { await openExternal(url) } catch { setResult('Could not open the link. Please try again.') }
  }

  async function send(event) {
    event.preventDefault()
    if (!valid || sending) return
    setSending(true)
    setResult('')
    try {
      const response = await sendFeedback({ name: name.trim(), email: email.trim(), message: message.trim() })
      if (!response.ok) throw new Error(response.error || 'Could not send feedback. Please try again.')
      try { localStorage.setItem(`support-feedback-contact-${appId}-v1`, JSON.stringify({ name: name.trim(), email: email.trim() })) } catch {}
      setMessage('')
      setResult(content.feedback.success)
    } catch (error) { setResult(content.feedback.failure) }
    finally { setSending(false) }
  }

  return <dialog ref={dialog} className={`support-modal ${feedback ? 'feedback-modal' : ''}`} aria-labelledby="support-title"
    onCancel={event => { if (sending) event.preventDefault(); else onClose() }}>
    <div className="support-modal-header"><h2 id="support-title">{feedback ? content.feedback.title : `About ${appName} / Donate`}</h2>
      <button className="support-close" aria-label="Close dialog" disabled={sending} onClick={onClose}><X size={20} /></button></div>
    {feedback ? <>
      <p className="support-hint">{content.feedback.intro.replace('{appName}', appName)}</p>
      <form onSubmit={send}>
        <fieldset disabled={sending} className="feedback-fields"><div className="feedback-contact">
          <label>{fields.name.label}<input autoFocus name="name" autoComplete="name" required maxLength={fields.name.maxLength} value={name} onChange={event => setName(event.target.value)} /></label>
          <label>{fields.email.label}<input name="email" type="email" autoComplete="email" required maxLength={fields.email.maxLength} value={email} onChange={event => setEmail(event.target.value)} /></label>
        </div><p className="support-hint">Your name and email are remembered on this device after sending.</p>
        <label>{fields.message.label}<textarea name="message" required maxLength={fields.message.maxLength} rows={5} placeholder={content.feedback.placeholder} value={message} onChange={event => setMessage(event.target.value)} /></label></fieldset>
        <p className="support-hint">{content.feedback.privacy}</p>
        <p className="support-message" role="status">{result}</p>
        <div className="support-form-actions"><button type="button" disabled={sending} onClick={() => { setFeedback(false); setResult('') }}>Back</button>
          <button type="submit" className="support-primary" disabled={!valid || sending}><Send size={16} />{sending ? 'Sending...' : content.feedback.submit}</button></div>
      </form>
    </> : <div className="support-dialog">
      <header><img className="support-logo" src={appLogo} alt={appName} /><h3>{appName}</h3>
        <p className="support-version-row" role="status"><strong>Version {appVersion}</strong><span>{updateStatus}</span></p>
        <div className="support-actions"><button className="support-discord" onClick={() => visit(content.links.discord)}>{content.actions.discord}</button>
          <button disabled={updateBusy} onClick={checkForUpdates}>{updateAvailable ? `Download ${updateAvailable}` : content.actions.update}</button>
          <button onClick={() => { setFeedback(true); setResult('') }}>{content.actions.feedback}</button></div>
      </header>
      <div className="support-intro"><p>{content.intro.replace('{appName}', appName)}</p>
        <p>{content.projectsText} <a href={content.links.github} onClick={event => { event.preventDefault(); visit(event.currentTarget.href) }}>GitHub</a><span aria-hidden="true"> | </span><a href={content.links.website} onClick={event => { event.preventDefault(); visit(event.currentTarget.href) }}>AdamCh.com</a></p></div>
      <section aria-label="Donate" className="support-donations"><h3>{content.donationTitle}</h3><p>{content.donationText}</p>
        <div className="support-buttons">
          {content.platforms.map(platform => <div className="donation-option" key={platform.id}>
            <button className={`donation-button ${platform.id === 'buymeacoffee' ? 'coffee' : platform.id}-button`} onClick={() => visit(platform.url)}>
              {platform.id === 'paypal' ? <span className="paypal-mark" style={{ '--paypal-mark': `url("${paypalMark}")` }} aria-hidden="true" /> : <img src={platform.id === 'github' ? githubMark : coffeeMark} alt="" />}
              <span>{platform.label}</span>
            </button><div className="donation-notes">{platform.notes.map(note => <span key={note}>{note}</span>)}</div>
          </div>)}
        </div>
      </section><p className="support-message" role="status">{result}</p>
    </div>}
  </dialog>
}
