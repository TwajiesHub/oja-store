import { useEffect } from 'react'

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Ọjà` : 'Ọjà | The best of made-in-Nigeria, in one market'
  }, [title])
}
