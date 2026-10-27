import { useState, type KeyboardEvent } from 'react'
import type { ClueType } from '../../api/clues'
import { CheckIcon, CrossIcon } from '../session/icons'
import { mediaLabel } from './board'
import { MediaBadge } from './ClueBadges'
import { MediaIcon, TrashIcon } from './icons'

export interface ClueFields {
  question: string
  answer: string
  clueType: ClueType
  mediaUrl: string | null
}

interface ClueDialogProps {
  // Where the clue is, such as "Our family · Jeopardy! · row 2".
  context: string
  title: string
  initial: ClueFields
  // Final Jeopardy has no media.
  allowMedia: boolean
  onSave: (fields: ClueFields) => void
  onTrash: () => void
  onClose: () => void
}

const MEDIA_TYPES: readonly ClueType[] = ['IMAGE', 'VIDEO', 'SOUND']

// Writes or edits one clue. It always shows everything, blind editing or
// not: the host is the one writing it.
function ClueDialog({
  context,
  title,
  initial,
  allowMedia,
  onSave,
  onTrash,
  onClose,
}: ClueDialogProps) {
  const [fields, setFields] = useState(initial)
  const hasMedia = fields.clueType !== 'TEXT'

  const set = (changes: Partial<ClueFields>) =>
    setFields(current => ({ ...current, ...changes }))

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div className="custom-overlay" onKeyDown={closeOnEscape}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="clue-dialog-title"
        className="custom-dialog"
        onSubmit={event => {
          event.preventDefault()
          onSave(fields)
        }}
      >
        <div className="custom-dialog-header">
          <div>
            <span className="custom-label">{context}</span>
            <h2 id="clue-dialog-title" className="custom-dialog-title">
              {title}
              {' '}
              <MediaBadge clueType={fields.clueType} />
            </h2>
          </div>
          <button
            type="button"
            className="custom-icon-button is-framed"
            aria-label="Close"
            onClick={onClose}
          >
            <CrossIcon size={20} />
          </button>
        </div>

        <div className="custom-dialog-body">
          <div className="custom-dialog-fields">
            <label className="custom-field">
              <span className="custom-label">Clue</span>
              <textarea
                className="is-serif"
                rows={3}
                autoFocus
                value={fields.question}
                onChange={event => set({ question: event.target.value })}
              />
              <span className="custom-help">What the host reads. Players answer it.</span>
            </label>

            {allowMedia && !hasMedia && (
              <div className="custom-media-add" role="group" aria-label="Media">
                <span className="custom-label">Media · none, text only</span>
                {MEDIA_TYPES.map(clueType => (
                  <button
                    key={clueType}
                    type="button"
                    className="outline-button"
                    onClick={() => set({ clueType, mediaUrl: '' })}
                  >
                    <MediaIcon clueType={clueType} size={16} />
                    Add {mediaLabel(clueType).toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {allowMedia && hasMedia && (
              <MediaFields
                clueType={fields.clueType}
                mediaUrl={fields.mediaUrl ?? ''}
                onChange={set}
              />
            )}

            <label className="custom-field">
              <span className="custom-label">Correct response</span>
              <textarea
                rows={2}
                value={fields.answer}
                onChange={event => set({ answer: event.target.value })}
              />
              <span className="custom-help">
                <b>A | B</b> accepts either · <b>[A | B]</b> groups the ways to
                say one answer · <b>(2 of)</b> asks for that many
              </span>
            </label>

            <NotationExample />
          </div>

          <div className="custom-dialog-preview">
            <span className="custom-label">When it's picked</span>
            <div className="custom-screen">
              {hasMedia && fields.mediaUrl?.trim() && (
                <MediaPreview clueType={fields.clueType} url={fields.mediaUrl.trim()} />
              )}
              <p className="custom-screen-clue">{fields.question || ' '}</p>
            </div>
          </div>
        </div>

        <div className="custom-dialog-footer">
          <button type="button" className="custom-trash-button" onClick={onTrash}>
            <TrashIcon />
            Trash clue
          </button>
          <span className="custom-help">Saving a change marks the clue Custom.</span>
          <button type="button" className="outline-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gold-button">Save clue</button>
        </div>
      </form>
    </div>
  )
}

interface MediaFieldsProps {
  clueType: ClueType
  mediaUrl: string
  onChange: (changes: Partial<ClueFields>) => void
}

function MediaFields({ clueType, mediaUrl, onChange }: MediaFieldsProps) {
  // Bumped by "Check again" to load the link anew.
  const [attempt, setAttempt] = useState(0)
  const url = mediaUrl.trim()

  return (
    <fieldset className="custom-media">
      <legend className="custom-label">Media</legend>

      <div className="custom-media-row">
        <div className="custom-segmented" role="radiogroup" aria-label="Media type">
          {MEDIA_TYPES.map(type => (
            <label key={type} className={type === clueType ? 'is-on' : ''}>
              <input
                type="radio"
                name="media-type"
                checked={type === clueType}
                onChange={() => onChange({ clueType: type })}
              />
              <MediaIcon clueType={type} size={16} />
              {mediaLabel(type)}
            </label>
          ))}
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => onChange({ clueType: 'TEXT', mediaUrl: null })}
        >
          <TrashIcon size={18} />
          Remove media
        </button>
      </div>

      <label className="custom-field">
        <span className="custom-label">Link</span>
        <span className="custom-media-row">
          <input
            type="url"
            value={mediaUrl}
            placeholder="https://…"
            onChange={event => onChange({ mediaUrl: event.target.value })}
          />
          <button
            type="button"
            className="outline-button"
            disabled={!url}
            onClick={() => setAttempt(attempt + 1)}
          >
            Check again
          </button>
        </span>
      </label>

      {url
        ? <MediaStatus key={`${clueType} ${url} ${attempt}`} clueType={clueType} url={url} />
        : <p className="custom-help">Paste a link to the {mediaLabel(clueType).toLowerCase()}.</p>}
    </fieldset>
  )
}

type LoadStatus = 'checking' | 'loads' | 'broken'

interface MediaStatusProps {
  clueType: ClueType
  url: string
}

// Whether the link loads, tried in the browser the way players will see it.
// Remounted (by its key) for every link and every "Check again".
function MediaStatus({ clueType, url }: MediaStatusProps) {
  const [status, setStatus] = useState<LoadStatus>('checking')
  const kind = mediaLabel(clueType).toLowerCase()

  const handlers = {
    onError: () => setStatus('broken'),
    hidden: true,
  }

  return (
    <>
      {clueType === 'IMAGE' && (
        <img src={url} alt="" onLoad={() => setStatus('loads')} {...handlers} />
      )}
      {clueType === 'VIDEO' && (
        <video src={url} preload="metadata" onLoadedMetadata={() => setStatus('loads')} {...handlers} />
      )}
      {clueType === 'SOUND' && (
        <audio src={url} preload="metadata" onLoadedMetadata={() => setStatus('loads')} {...handlers} />
      )}

      <p className={`custom-media-status is-${status}`} role="status">
        {status === 'checking' && `Checking the ${kind}…`}
        {status === 'loads' && <><CheckIcon /> Loads: players will see this {kind}.</>}
        {status === 'broken' && (
          <>
            <CrossIcon /> Broken: this {kind} didn't load. Paste a new link, or
            remove the media to keep the clue as text.
          </>
        )}
      </p>
    </>
  )
}

interface MediaPreviewProps {
  clueType: ClueType
  url: string
}

// The media on the clue screen, as players will get it.
function MediaPreview({ clueType, url }: MediaPreviewProps) {
  switch (clueType) {
    case 'IMAGE':
      return <img className="custom-screen-media" src={url} alt="" />
    case 'VIDEO':
      return <video className="custom-screen-media" src={url} controls />
    case 'SOUND':
      return <audio className="custom-screen-media" src={url} controls />
    default:
      return null
  }
}

// Always the same example, whatever the host is writing.
function NotationExample() {
  const options = [
    ['Abraham Lincoln', 'or Lincoln'],
    ['Andrew Jackson', 'or Jackson'],
    ['John Adams', 'or Adams'],
  ]

  return (
    <div className="custom-example">
      <span className="custom-label">Example</span>
      <p className="custom-help">
        If the correct response is{' '}
        <i className="custom-notation">
          (2 of) [Lincoln | Abraham Lincoln] | [Jackson | Andrew Jackson] | [Adams | John Adams]
        </i>
        , then players must name any 2 of:
      </p>
      <div className="custom-example-options">
        {options.map(([name, short]) => (
          <div key={name}>
            <strong>{name}</strong>
            <span>{short}</span>
          </div>
        ))}
      </div>
      <p className="custom-help">For example, "Lincoln and Adams" is right. "Lincoln" alone is not.</p>
    </div>
  )
}

export default ClueDialog
