import { useEffect, useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<'video'>, 'ref'> & {
  videoRef?: (node: HTMLVideoElement | null) => void
  recoveryHint?: string
}

export function ReliableVideo({ src, videoRef, recoveryHint = '请确认文件仍存在，或改用 H.264 视频 + AAC 音频的 MP4。', onError, onWaiting, onStalled, onCanPlay, onPlaying, ...props }: Props) {
  const [failure, setFailure] = useState('')
  const [buffering, setBuffering] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { setFailure(''); setBuffering(false); setAttempt(0) }, [src])

  return <>
    <video {...props} key={`${src}:${attempt}`} src={src} ref={videoRef} onError={event => {
      const code = event.currentTarget.error?.code
      setFailure(code === 2 ? '无法读取该视频文件。' : code === 3 ? '无法解码该视频编码。' : code === 4 ? '不支持该视频格式。' : '无法播放该视频。')
      setBuffering(false)
      onError?.(event)
    }} onWaiting={event => { setBuffering(true); onWaiting?.(event) }} onStalled={event => { setBuffering(true); onStalled?.(event) }} onCanPlay={event => { setBuffering(false); setFailure(''); onCanPlay?.(event) }} onPlaying={event => { setBuffering(false); onPlaying?.(event) }} />
    {failure ? <p className="media-playback-feedback error" role="alert">{failure} {recoveryHint} <button type="button" onClick={() => { setFailure(''); setBuffering(false); setAttempt(value => value + 1) }}>重试播放</button></p> : buffering ? <p className="media-playback-feedback" role="status" aria-live="polite">视频缓冲中…</p> : null}
  </>
}
