import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { EmptyState } from '../components/Feedback'

export default function NotFound({ what = 'Seite' }: { what?: string }) {
  return (
    <EmptyState
      icon={<SearchX />}
      title={`${what} nicht gefunden`}
      text="Der Link ist evtl. falsch geschrieben oder die Abstimmung wurde gelöscht."
      action={<Link to="/" className="btn-primary">Zur Startseite</Link>}
    />
  )
}
