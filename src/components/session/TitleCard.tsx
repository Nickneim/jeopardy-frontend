interface TitleCardProps {
  // "Double Jeopardy!", shown a word per line.
  title: string
  // Whether the letters zoom in. A Daily Double's don't: the whole screen
  // flips in (useClueZoom).
  zoom?: boolean
}

// The whole screen for a moment, in big gold letters: a round's title card,
// or a Daily Double's announcement.
function TitleCard({ title, zoom = true }: TitleCardProps) {
  return (
    <h2 className={zoom ? 'tv-title is-card' : 'tv-title'}>
      {title.split(' ').map((word, index) => (
        <span key={index}>{word}</span>
      ))}
    </h2>
  )
}

export default TitleCard
