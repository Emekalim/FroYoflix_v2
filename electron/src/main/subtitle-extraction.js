import { basename, dirname, extname, join } from 'node:path'

const textSubtitleFormats = {
    ass: 'ass',
    ssa: 'ass',
    subrip: 'srt',
    srt: 'srt',
    webvtt: 'vtt',
    mov_text: 'srt'
}

const languageAliases = {
    en: 'eng',
    eng: 'eng',
    english: 'eng',
    jp: 'jpn',
    jpn: 'jpn',
    ja: 'jpn',
    japanese: 'jpn',
    es: 'spa',
    spa: 'spa',
    spanish: 'spa',
    de: 'ger',
    ger: 'ger',
    deu: 'ger',
    german: 'ger',
    fr: 'fre',
    fre: 'fre',
    fra: 'fre',
    french: 'fre',
    it: 'ita',
    ita: 'ita',
    italian: 'ita',
    pt: 'por',
    por: 'por',
    portuguese: 'por'
}

function sanitizeSegment(value, fallback = '') {
    const sanitized = String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s/g, '.')

    return sanitized || fallback
}

export function getTextSubtitleFormat(codecName) {
    return textSubtitleFormats[String(codecName || '').toLowerCase()] || null
}

export function getSubtitleEncoder(format) {
    if (format === 'ass') return 'ass'
    if (format === 'vtt') return 'webvtt'
    if (format === 'srt') return 'srt'
    return null
}

export function normalizeSubtitleLanguage(value) {
    const key = String(value || '').toLowerCase().trim()
    return languageAliases[key] || (key.length >= 2 && key.length <= 3 ? key : null)
}

export function buildSubtitleOutputPath(filePath, { language, title, disposition = {}, format, occurrence = 1 }) {
    const folder = join(dirname(filePath), 'Subtitles')
    const stem = basename(filePath, extname(filePath))
    const parts = [stem]
    if (language) parts.push(sanitizeSegment(language))
    if (disposition?.forced) parts.push('forced')
    else if (disposition?.default) parts.push('default')
    const cleanTitle = sanitizeSegment(title)
    if (cleanTitle) parts.push(cleanTitle)
    if (occurrence > 1) parts.push(String(occurrence))
    return join(folder, `${parts.join('.')}.${format}`)
}

export function buildSubtitleExtractionPlan({ filePath, streams = [] }) {
    const nameCounts = new Map()
    const plan = []

    for (const stream of streams) {
        if (stream?.codec_type !== 'subtitle') continue
        const format = getTextSubtitleFormat(stream.codec_name)
        if (!format) continue

        const language = normalizeSubtitleLanguage(stream.tags?.language)
        const title = stream.tags?.title || stream.tags?.handler_name || ''
        const disposition = stream.disposition || {}
        const key = `${language || 'und'}|${sanitizeSegment(title)}|${disposition.forced ? 'forced' : disposition.default ? 'default' : 'normal'}|${format}`
        const occurrence = (nameCounts.get(key) || 0) + 1
        nameCounts.set(key, occurrence)

        plan.push({
            index: stream.index,
            format,
            encoder: getSubtitleEncoder(format),
            language,
            title,
            disposition,
            destinationPath: buildSubtitleOutputPath(filePath, {
                language,
                title,
                disposition,
                format,
                occurrence
            })
        })
    }

    return plan
}
