import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_TIMER_MODES, type HostMode } from '../../api/sessions'
import { makeSession } from '../../test/fixtures'
import Lobby from './Lobby'

function renderLobby(hostMode: HostMode, playerCount: number, isHost = true) {
  const onUpdateSettings = vi.fn()
  const onStart = vi.fn()

  render(
    <Lobby
      code="7KQ2M"
      isHost={isHost}
      hostName="Alex"
      hostMode={hostMode}
      playerCount={playerCount}
      timers={makeSession().timers}
      timerModes={DEFAULT_TIMER_MODES}
      allowLateJoin
      clueTypes={[]}
      onStart={onStart}
      onUpdateTimers={() => {}}
      onUpdateSettings={onUpdateSettings}
    />,
  )
  return { onUpdateSettings, onStart }
}

describe('Lobby', () => {
  test('lets the host choose to run the show as Trebek', async () => {
    const { onUpdateSettings } = renderLobby('CONTESTANT', 2)

    expect(screen.getByRole('radio', { name: /Play along/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /Be Trebek/ }))

    expect(onUpdateSettings).toHaveBeenCalledWith({ hostMode: 'TREBEK' })
  })

  test("doesn't start a Trebek game before someone joins to play", () => {
    renderLobby('TREBEK', 0)

    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled()
    expect(screen.getByText(/wait for at least one player/)).toBeInTheDocument()
  })

  test('tells the players their host is Trebek', () => {
    renderLobby('TREBEK', 2, false)

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByText(/is hosting as Trebek/)).toBeInTheDocument()
  })
})
