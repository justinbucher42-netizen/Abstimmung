import { Navigate, useParams } from 'react-router-dom'

export default function JoinRedirect() {
  const { code = '' } = useParams()
  return <Navigate to={`/vote/${code.toUpperCase()}`} replace />
}
