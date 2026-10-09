import { Form, useActionData, useNavigation } from 'react-router'
import type { JoinActionData } from '../../api/sessions'

function JoinForm() {
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
        />
      </label>

      <button type="submit" disabled={isJoining}>
        {isJoining ? 'Joining…' : 'Join game'}
      </button>

      {actionData?.error && (
        <p className="form-error" role="alert">{actionData.error}</p>
      )}
    </Form>
  )
}

export default JoinForm
