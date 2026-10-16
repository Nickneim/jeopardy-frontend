import { Form, useActionData, useNavigation } from 'react-router'
import {
  getRememberedPlayerName,
  type JoinActionData,
} from '../../api/sessions'
import { formatMoney } from '../../format'

interface JoinFormProps {
  joinScore: number
  // Back to watching, without joining.
  onCancel: () => void
}

function JoinForm({
  joinScore,
  onCancel,
}: JoinFormProps) {
  const actionData = useActionData() as JoinActionData | undefined
  const navigation = useNavigation()

  const isJoining = navigation.state === 'submitting'

  return (
    <Form method="post" className="join-form">
      <label>
        Your name
        <input
          name="playerName"
          required
          maxLength={40}
          autoComplete="nickname"
          defaultValue={getRememberedPlayerName()}
          autoFocus
        />
      </label>

      <button type="submit" disabled={isJoining}>
        {isJoining ? 'Joining…' : 'Join game'}
      </button>

      <button type="button" disabled={isJoining} onClick={onCancel}>
        Just watch
      </button>

      {joinScore < 0 && (
        <p>You'll start with {formatMoney(joinScore)}.</p>
      )}

      {actionData?.error && (
        <p className="form-error" role="alert">{actionData.error}</p>
      )}
    </Form>
  )
}

export default JoinForm
