function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function truthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes'
}

/**
 * Build an HLS master playlist that supports alternate audio renditions.
 *
 * @param {Object} opts
 * @param {string} opts.videoUri - URI to the video media playlist (may include query params).
 * @param {Array<{ uri: string, name: string, language?: string | null, isDefault?: boolean }>} [opts.audioRenditions]
 * @returns {string}
 */
export function buildHlsMasterPlaylist({ videoUri, audioRenditions = [] }) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3']

  const audios = (audioRenditions || []).filter((a) => a?.uri)
  if (!audios.length) {
    lines.push('#EXT-X-STREAM-INF:BANDWIDTH=8000000')
    lines.push(String(videoUri))
    return lines.join('\n') + '\n'
  }

  const defaultIndex = (() => {
    const explicit = audios.findIndex((a) => truthy(a.isDefault))
    return explicit >= 0 ? explicit : 0
  })()

  for (let index = 0; index < audios.length; index += 1) {
    const audio = audios[index]
    const isDefault = index === defaultIndex
    const attrs = [
      'TYPE=AUDIO',
      'GROUP-ID="audio"',
      audio.language ? `LANGUAGE="${escapeAttribute(audio.language)}"` : null,
      `NAME="${escapeAttribute(audio.name || audio.language || `Track ${index + 1}`)}"`,
      `DEFAULT=${isDefault ? 'YES' : 'NO'}`,
      'AUTOSELECT=YES',
      `URI="${escapeAttribute(audio.uri)}"`
    ].filter(Boolean)
    lines.push(`#EXT-X-MEDIA:${attrs.join(',')}`)
  }

  lines.push('#EXT-X-STREAM-INF:BANDWIDTH=8000000,AUDIO="audio"')
  lines.push(String(videoUri))
  return lines.join('\n') + '\n'
}
