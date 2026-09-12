/* CJK ~400 chars/min, latin ~220 words/min — shared by the server
   (list/detail payloads) and the client. */

export function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ')
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length
  const words = (text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? []).length
  return Math.max(1, Math.ceil(cjk / 400 + words / 220))
}
