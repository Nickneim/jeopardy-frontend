interface TitleCardProps {
  // "Double Jeopardy!", shown a word per line.
  title: string
}

// The whole screen for a moment, in big gold letters that zoom in: a
// round's title card, or a Daily Double's announcement.
function TitleCard({ title }: TitleCardProps) {
  return (
    <h2 className="tv-title is-card">
      {title.split(' ').map((word, index) => (
        <span key={index}>{word}</span>
      ))}
    </h2>
  )
}

export default TitleCard
