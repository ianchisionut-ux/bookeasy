'use client'

import { useEffect, useMemo, useState } from 'react'

type InlineAttachment = {
  id: string
  contentId: string | null
  contentType: string
  available: boolean
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export default function EmailHtmlView({ emailId, html, attachments }: {
  emailId: string; html: string; attachments: InlineAttachment[]
}) {
  const [showExternalImages, setShowExternalImages] = useState(true)
  const [inlineImages, setInlineImages] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    setInlineImages({})
    const images = attachments.filter((item) => item.available && item.contentId && item.contentType.startsWith('image/'))
    Promise.all(images.map(async (item) => {
      const response = await fetch(`/api/superadmin/email/${emailId}/attachments/${item.id}`, { cache: 'no-store' })
      if (!response.ok) return null
      const contentId = item.contentId!.replace(/^<|>$/g, '').toLowerCase()
      return [contentId, await asDataUrl(await response.blob())] as const
    })).then((entries) => {
      if (active) setInlineImages(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))))
    }).catch(() => { if (active) setInlineImages({}) })
    return () => { active = false }
  }, [emailId, attachments])

  const documentHtml = useMemo(() => {
    const withInlineImages = html.replace(/(src\s*=\s*["'])cid:([^"']+)(["'])/gi, (original, before: string, id: string, after: string) => {
      const value = inlineImages[id.replace(/^<|>$/g, '').toLowerCase()]
      return value ? `${before}${value}${after}` : original
    })
    const imageSources = showExternalImages ? 'data: https:' : 'data:'
    const policy = `default-src 'none'; img-src ${imageSources}; style-src 'unsafe-inline'; font-src data: https:; form-action 'none'`
    return `<meta http-equiv="Content-Security-Policy" content="${policy}"><style>html,body{margin:0;padding:0;overflow-wrap:anywhere}body{padding:12px;font-family:Arial,sans-serif}img{max-width:100%!important;height:auto!important}</style>${withInlineImages}`
  }, [html, inlineImages, showExternalImages])

  return <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
    <button className="btn-secondary mb-3" onClick={() => setShowExternalImages((value) => !value)}>
      {showExternalImages ? 'Ascunde imaginile externe' : 'Afișează imaginile externe'}
    </button>
    <iframe title="Conținutul emailului" sandbox="" referrerPolicy="no-referrer"
      srcDoc={documentHtml} className="w-full min-h-[540px] rounded-xl border border-[var(--border-soft)] bg-white" />
  </div>
}
